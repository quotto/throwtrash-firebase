import moment = require('moment-timezone');
import rp = require('request-promise');
import * as common from "trash-common";
import {RecentTrashDate} from "./common/domain";
import {DBAdapter} from "./common/db-adapter";
import {TextCreator} from "./common/text-creator";

const logger = common.getLogger();

export class Client {
    private dbAdapter: DBAdapter;
    private timezone: string;
    private textCreator: TextCreator;
    constructor(_timezone:string, _text_creator: TextCreator, _dbAdapter: DBAdapter){
        this.timezone = _timezone || 'utc';
        this.textCreator = _text_creator;
        this.dbAdapter = _dbAdapter;
    }

    /**
    access_token: アクセストークン
    target_day: 0:今日,1:明日
    **/
    async getTrashData(access_token: string) {
        try {
            let user_id:string = access_token;
            // 非互換用のチェック条件,access_tokenが36桁の場合はuser_idとみなして直接TrashScheduleを検索する
            if(access_token.length != 36) {
                user_id = await this.dbAdapter.getUserIDByAccessToken(access_token);
            }

            if(user_id) {
                const scheduleData: common.TrashData[] = await this.dbAdapter.getTrashSchedule(user_id);
                if (scheduleData && scheduleData.length > 0) {
                    return {
                        status: 'success',
                        response: scheduleData
                    };
                }
            }
            logger.error(`User Not Found(AccessToken: ${access_token})`);
            return {
                status: 'error',
                msgId: 'id_not_found_error'
            };
        } catch(err) {
            logger.error(err);
            return {
                    status:'error',
                    msgId: 'general_error'
            };
        }
    }

    /**
    target_day: 対象とする日を特定するための値。0なら今日、1なら明日……となる。
    **/
    calculateLocalTime(target_day: number): Date {
        logger.debug(`Timezone: ${this.timezone}`)
        const utcTime:number = Date.now(); //UTC時刻
        logger.debug(`utctime: ${utcTime}`)
        const timeZoneMoment = moment.tz.zone(this.timezone);
        if(timeZoneMoment) {
            const localeoffset:number = timeZoneMoment.utcOffset(utcTime);
            // UTCからこのプログラムが稼働するコンピュータ時刻のオフセットを差し引き（オフセットはUTC+ ならマイナス, UTC- ならプラス）、求めたいロケール（ユーザーのロケール）のオフセットを追加することで、new Date(localtime)でのgetXX系がすべてユーザーロケールでの状態になる
            const localtime:number = utcTime + (new Date().getTimezoneOffset() * 60 * 1000) + ((-1 * localeoffset) * 60 * 1000) + (60 * 24 * 60 * 1000 * target_day);
            logger.debug(`LocaleTime: ${localtime}`)
            return new Date(localtime);
        }
        throw new Error("calculateLocalTime Failed -> timeZoneMoment is null");
    }

    /**
     * 計算対象日を求める
     * 指定された曜日が現時点から何日後かを返す
    **/
    getTargetDayByWeekday(target_weekday: number): number {
        const dt:Date = this.calculateLocalTime(0);
        const now_weekday:number = dt.getDay();
        let target_day = target_weekday - now_weekday;
        //1より小さい場合は翌週分
        if(target_day < 1) {
            target_day += 7;
        }
        return target_day;
    }

    async getEnableTrashData(trash: common.TrashData,dt:Date): Promise<common.TrashTypeValue | undefined> {
        const trash_name: string = trash.type ==='other' && trash.trash_val ? trash.trash_val : this.textCreator.getTrashName(trash.type);
        const trash_data:common.TrashTypeValue = {
            type: trash.type,
            name: trash_name
        };

        const check = (schedule: {type: string, value: string | common.EvweekValue}): boolean =>{
            if(schedule.type === 'weekday') {
                return Number(schedule.value) === dt.getDay();
            } else if(schedule.type === 'biweek') {
                const matches: RegExpMatchArray | null = (schedule.value as string).match(/(\d)-(\d)/);
                if(matches) {
                    const weekday = Number(matches[1]);
                    const turn = Number(matches[2]);

                    // 現在何週目かを求める
                    let nowturn = 0;
                    let targetdate:number = dt.getDate();
                    while (targetdate > 0) {
                        nowturn += 1;
                        targetdate -= 7;
                    }

                    return weekday === dt.getDay() && turn === nowturn;
                }
            } else if(schedule.type === 'month') {
                return dt.getDate() === Number(schedule.value);
            } else if(schedule.type === 'evweek') {
                const schedule_value: common.EvweekValue = schedule.value as common.EvweekValue;
                if(Number(schedule_value.weekday) === dt.getDay()) {
                    const start_dt:Date = new Date(schedule_value.start);
                    start_dt.setHours(0);
                    start_dt.setMinutes(0);
                    start_dt.setSeconds(0);
                    start_dt.setMilliseconds(0);

                    // 今週の日曜日を求める
                    const current_dt:Date = new Date(dt.toISOString());
                    current_dt.setHours(0);
                    current_dt.setMinutes(0);
                    current_dt.setSeconds(0);
                    current_dt.setMilliseconds(0);
                    current_dt.setDate(current_dt.getDate() - current_dt.getDay());

                    // 登録されている日付からの経過日数を求める
                    const past_date = (current_dt.getTime() - start_dt.getTime()) / 1000 / 60 / 60 / 24;

                    // 差が0またはあまりが0であれば隔週に該当
                    // trash_data.schedule = [];
                    return past_date === 0 || (past_date / 7) % 2 === 0;
                }
            }
            return false;
        }
        if(trash.schedules.some(check)) {
            // 一つでもゴミ捨て可能なスケジュールがあればそのゴミ（typeとname）を返す
            return trash_data;
        }
        return undefined;
    }

    /**
    trashes:   DynamoDBから取得したJSON形式のパラメータ。
    target_day: チェックするn日目。0なら今日、1なら明日......
    **/
    async checkEnableTrashes(trashes: Array<common.TrashData>, target_day: number): Promise<Array<common.TrashTypeValue>> {
        const dt = this.calculateLocalTime(target_day);
        const promise_list: Promise<common.TrashTypeValue | undefined>[] = [];
        trashes.forEach((trash) => {
            promise_list.push(
                this.getEnableTrashData(trash,dt)
            );
        });
        const result:Array<common.TrashTypeValue | undefined> = await Promise.all(promise_list);
        logger.debug('CheckEnableTrashes result:'+JSON.stringify(result));
        // 同名のゴミがあった場合に重複を排除する
        const keys: string[] = [];

        // undefinedはfilter内で除外するためTrashTypeValue[]としてreturnする
        return result.filter((value: common.TrashTypeValue | undefined) =>{
            // key配列に存在しない場合のみkeyを追加
            if(value && keys.indexOf(value.type + value.name) < 0) {
                const key: string = value.type+value.name;
                keys.push(key);
                return true;
            }
            return false;
        }) as common.TrashTypeValue[];
    }

    /**
     * スケジュールの種類と値に従い今日から最も近い 日にちを返す。
     * @param {Date} today タイムゾーンを考慮した今日の日付
     * @param {String} schedule_type スケジュールの種類
     * @param {String} schedule_val スケジュールの値
     * @returns {Date} 条件に合致する直近の日にち
     */
    calculateNextDateBySchedule(today: Date, schedule_type: string, schedule_val: string | common.EvweekValue): Date {
        const next_dt: Date = new Date(today.getTime());
        if(schedule_type === 'weekday') {
            const diff_day: number = Number(schedule_val) - today.getDay();
            diff_day < 0 ? next_dt.setDate(today.getDate() + (7 + diff_day)) : next_dt.setDate(today.getDate() + diff_day);
        } else if (schedule_type === 'month') {
            let now_date: number = today.getDate();
            while(now_date != Number(schedule_val)) {
                // スケジュールと現在の日にちの差分を取る
                const diff_date = Number(schedule_val) - now_date;
                if(diff_date < 0) {
                    // 現在日>設定日の場合は翌月の1日をセットする
                    next_dt.setMonth(next_dt.getMonth() + 1);
                    next_dt.setDate(1);
                } else {
                    // 現在日<設定日の場合は差分の分だけ日にちを進める
                    next_dt.setDate(next_dt.getDate() + diff_date);
                }
                now_date = next_dt.getDate();
            }
        } else if(schedule_type === 'biweek') {
            // 設定値
            const matches: RegExpMatchArray | null = (schedule_val as string).match(/(\d)-(\d)/);
            if(matches) {
                const weekday = Number(matches[1]);
                const turn = Number(matches[2]);

                // 直近の同じ曜日の日にちを設定
                const diff_day = weekday - today.getDay();
                diff_day < 0 ? next_dt.setDate(today.getDate() + (7 + diff_day)) : next_dt.setDate(today.getDate() + diff_day);

                // 何週目かを求める
                let nowturn = 0;
                let targetdate: number = next_dt.getDate();
                while(targetdate > 0) {
                    nowturn += 1;
                    targetdate -= 7;
                }

                let current_month: number = next_dt.getMonth();
                while(turn != nowturn) {
                    next_dt.setDate(next_dt.getDate()+7);
                    if(current_month != next_dt.getMonth()) {
                        nowturn = 1;
                        current_month = next_dt.getMonth();
                    } else {
                        nowturn += 1;
                    }
                }
            }
        } else if(schedule_type === 'evweek') {
            const evweek_val: common.EvweekValue = schedule_val as common.EvweekValue;
            const start_dt: Date = new Date(evweek_val.start);
            start_dt.setHours(0);
            start_dt.setMinutes(0);
            start_dt.setSeconds(0);
            start_dt.setMilliseconds(0);

            // 直近の同じ曜日の日にちを設定
            const diff_date: number = Number(evweek_val.weekday) - today.getDay();
            diff_date < 0 ? next_dt.setDate(today.getDate() + (7 + diff_date)) : next_dt.setDate(today.getDate() + diff_date);

            // 直近の同じ曜日の日にちの日曜日を取得
            const current_dt: Date = new Date(next_dt.getTime());
            current_dt.setHours(0);
            current_dt.setMinutes(0);
            current_dt.setSeconds(0);
            current_dt.setMilliseconds(0);
            current_dt.setDate(current_dt.getDate() - current_dt.getDay());

            // 登録されている日付からの経過日数を求める
            const past_date: number = (current_dt.getTime() - start_dt.getTime()) / 1000 / 60 / 60 / 24;

            // 差が0以外かつあまりが0でなければ1週間進める
            if(past_date != 0 && (past_date / 7) % 2 != 0) {
                next_dt.setDate(next_dt.getDate()+7);
            }
        }
        return next_dt;
    }

    /*
    指定したごみの種類から直近のゴミ捨て日を求める
    trashes: DynamoDBから取得したJSON形式のパラメータ
    target_type: ごみの種類
    */
   /**
    * 指定したごみの種類から直近のゴミ捨て日を求める。
    * trashesの中に同一のゴミ（typeが同じ）があれば一つにまとめる。ただしtypeがotherの場合のみゴミの名前（trash_val）で区別するため、戻り値のkeyは複数になる可能性がある。
    * @param {Array} trashes DynamoDBから取得した登録済みごみ出し予定
    * @param {string}} target_type 検索するゴミの種類
    * @returns {object} target_typeで指定されたゴミの直近の予定日プロパティ。{key:ゴミの種類,schedules:登録されているごみ出し予定,list:登録スケジュールから算出した直近の予定日,recent: listの中で最も近い日}
    */
    getDayByTrashType(trashes: Array<common.TrashData>, target_type: string): RecentTrashDate[] {
        logger.debug('getDayByTrashType'+JSON.stringify(trashes)+',type:'+target_type);
        const match_dates: RecentTrashDate[] = [];
        trashes.forEach((trash)=>{
            if(trash.type === target_type) {
                const key: string = trash.type === 'other' && trash.trash_val ? trash.trash_val : trash.type;

                // 配列にkeyが存在しなければ初期状態で追加
                if(match_dates.filter((recentTrashData)=>{recentTrashData.key === key}).length === 0) {
                    // schedules:登録されているスケジュール,list:登録スケジュールに対応する直近の日にち,recent:listのうち最も近い日にち
                    match_dates.push({
                        key: key,
                        schedules: trash.schedules,
                        list: [],
                        recent: new Date() // 最終的には直近のゴミ出し日が入るので初期値は何でも良い
                    });
                }
            }
        });

        const today_dt = this.calculateLocalTime(0);
        match_dates.forEach((recentTrashData)=>{
            let recently = new Date('9999/12/31');
            recentTrashData.schedules.forEach((schedule: common.TrashSchedule)=>{
                const next_dt: Date = this.calculateNextDateBySchedule(today_dt,schedule.type,schedule.value);
                if(recently.getTime() > next_dt.getTime()) {
                    recently =  new Date(next_dt.getTime());
                }
                recentTrashData.list.push(next_dt);
            });
            recentTrashData.recent = recently;
        });
        logger.debug('GetDayFromTrashType result:');
        logger.debug(JSON.stringify(match_dates,null,2));
        return match_dates;
    }

    /**
     * 
     * @param {Number} target_week  0:今週, 1:来週
     * @returns {Array} {target_day: オブジェクト配列
     */
    async getRemindBody(target_week: number, trash_data: Array<common.TrashData>) {
        const result_list: {target_day: number, body: any}[] = [];
        const today_dt: Date = this.calculateLocalTime(0);
        const weekNum: number = today_dt.getDay()
        if(target_week === 0) {
            // 今週の場合は明日以降の土曜日までの日にちを算出する
            for(let i=0; i<(6 - weekNum); i++) {
                const target_day: number = i+1;
                const result: Array<common.TrashTypeValue | undefined> = await this.checkEnableTrashes(trash_data, target_day)
                result_list.push({
                    target_day: target_day,
                    body: result
                });
            }
        } else if(target_week === 1) {
            const padding_date: number = 7 - weekNum;
            // 来週の場合は次の日曜日を求める
            for(let i=0; i<7; i++) {
                const target_day: number = i+padding_date
                const result: Array<common.TrashTypeValue | undefined> = await this.checkEnableTrashes(trash_data, target_day);
                result_list.push({
                    target_day:  target_day,
                    body: result
                });
            }
        }
        return result_list;
    }

    async compareTwoText(text1: string, text2: string): Promise<number> {
        if(text1 && text2) {
            const option = {
                uri: process.env.MecabAPI_URL + '/compare',
                qs: {
                    text1: text1,
                    text2: text2
                },
                json: true
            };
            logger.info('Compare option:'+JSON.stringify(option));
            return rp(option).then((response: any) => {
                return response.score as number;
            }).catch((err: any) => {
                logger.error(err);
                throw err;
            });
        }
        logger.error(`Compare invalid parameter:${text1},${text2}`);
        return Promise.reject('err');
    }
}