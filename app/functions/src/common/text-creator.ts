import {TrashTypeValue,TrashData,EvweekValue} from "trash-common";
import {TrashDataText} from "./domain";

const get_num_sufix = (number: number): string => {
    let suffix = 'th';
    if (number === 1) {
        suffix = 'st';
    } else if (number === 2) {
        suffix = 'nd';
    } else if (number === 3) {
        suffix = 'rd';
    }

    return String(number) + suffix;
}

export class TextCreator {

    private locale: string;
    private localeText: any;
    private commonText: any;

    /**
     * 
     * @param {string} locale  デバイスから取得できるロケール情報
     */
    constructor(locale: string) {
        this.locale = locale;
        this.localeText = require(`./template_text/${this.locale}.text.json`);
        this.commonText = require(`./template_text/${this.locale}.common.json`);
    }

    createTrashMessageBody(trash_items: TrashTypeValue[]): string {
        const trash_name_list: string[] = [];
        trash_items.forEach((item) => {
            trash_name_list.push(
                item.type === 'other' ? item.name : this.commonText.trashname[item.type]
            );
        });
        const response_trashes = trash_name_list.join(this.localeText.separate);
        return response_trashes;
    }

    /**
     * 今日出せるゴミをテキスト化する
     * @param {Array<object>} trash_items typeとnameを要素に持つJSONオブジェクトの配列
     * @return {string} レスポンスに格納するテキスト
     */
    getLaunchResponse(trash_items: TrashTypeValue[]): string {
        if(trash_items.length === 0) {
            return this.localeText.result.launchnothing;
        } else {
            const body = this.createTrashMessageBody(trash_items);
            return this.localeText.result.launch.replace('%s', body);
        }
    }

    getPointdayResponse(target_day: string, trash_items: TrashTypeValue[]): string {
        if(trash_items.length === 0) {
            return this.localeText.result.pointnothing.replace('%s', this.commonText.pointday[target_day]);
        } else {
            const body = this.createTrashMessageBody(trash_items);
            return this.localeText.result.pointday.replace('%s1', this.commonText.pointday[target_day]).replace('%s2', body);
        }
    }

    getDayByTrashTypeMessage(slot_value: TrashTypeValue, target_trash: {key: string,recent: Date}[]): string {
        if (target_trash.length === 0) {
            return this.localeText.result.fromtrashnothing.replace('%s', slot_value.name);
        }
        if (slot_value.type === 'other') {
            const part_text: string[] = []
            target_trash.forEach((trash) => {
                part_text.push(
                    this.localeText.result.fromtrashtypepart.replace('%s1', trash.key)
                        .replace('%s2', this.localeText.result.fromtrashdate
                            .replace("%m", this.commonText.month ? this.commonText.month[trash.recent.getMonth()] : trash.recent.getMonth() + 1)
                            .replace('%d', trash.recent.getDate())
                            .replace('%w', this.commonText.weekday[trash.recent.getDay()]
                            ))
                );
            });
            const body = part_text.join(this.localeText.separate);
            return this.localeText.result.fromtrashtype.replace('%s', body);
        }
        else {
            return this.localeText.result.fromtrashtype.replace('%s', this.localeText.result.fromtrashtypepart
                .replace('%s1', slot_value.name)
                .replace('%s2', this.localeText.result.fromtrashdate
                    .replace("%m", this.commonText.month ? this.commonText.month[target_trash[0].recent.getMonth()] : target_trash[0].recent.getMonth() + 1)
                    .replace('%d', target_trash[0].recent.getDate())
                    .replace('%w', this.commonText.weekday[target_trash[0].recent.getDay()])
                ));

        }
    }

    get all_schedule(): string {
        return this.localeText.notice.registerdresponse;
    }

    get launch_reprompt(): string {
        return this.localeText.notice.continue;
    }

    get require_account_link(): string {
        return this.localeText.help.account;
    }

    get ask_point_day(): string {
        return this.localeText.notice.pointdayquestion;
    }

    get ask_trash_type(): string {
        return this.localeText.notice.fromtrashquestion;
    }

    get help(): string {
        return this.localeText.help.help;
    }

    get goodbye(): string {
        return this.localeText.help.bye;
    }

    get next_previous(): string {
        return this.localeText.help.nextprevious;
    }

    get require_reminder_permission(): string {
        return this.localeText.reminder.permission;
    }

    get ask_reminder_week(): string {
        return this.localeText.reminder.week;
    }

    get ask_reminder_time(): string {
        return this.localeText.reminder.time;
    }

    get finish_set_remind(): string {
        return this.localeText.reminder.finish;
    }

    get general_error(): string {
        return this.localeText.error.general;
    }

    get id_not_found_error(): string {
        return this.localeText.error.idnotfound;
    }

    get thanks(): string {
        return this.localeText.purchase.thanks;
    }

    get already(): string {
        return this.localeText.purchase.already;
    }
    get reprompt(): string {
        return this.localeText.purchase.reprompt;
    }

    get cancel(): string {
        return this.localeText.purchase.cancel;
    }

    get ok(): string {
        return this.localeText.purchase.ok;
    }

    get upsell(): string {
        return this.localeText.purchase.upsell;
    }

    get reminder_cancel(): string {
        return this.localeText.reminder.cancel;
    }

    get unknown_error(): string {
        return this.localeText.error.unknown;
    }

    getReminderConfirm(week_type: string, time: string): string {
        return this.localeText.reminder.confirm.replace('%s1', week_type).replace('%s2', time);
    }

    getReminderComplete(week_type: string, time: string): string {
        return this.localeText.reminder.complete.replace('%s1', week_type).replace('%s2', time);
    }

    getTrashName(trash_type: string): string {
        return this.commonText.trashname[trash_type];
    }

    /*
    全てのゴミ出し予定を整形された文書データで返す
    trashes: DynamoDBから取得したJSON形式のパラメータ
    */
    getAllSchedule(trashes: TrashData[]): TrashDataText[] {
        const return_data: TrashDataText[] = [];
        trashes.forEach((trash)=>{
            const trash_data: any = {};
            trash_data.type = trash.type;
            trash_data.typeText = trash.type != 'other' ? this.getTrashName(trash.type) : trash.trash_val;

            trash_data.schedules = [];
            trash.schedules.forEach((schedule)=>{
                if(schedule.type == 'weekday') {
                    const scheduleValue: string = schedule.value as string;
                    trash_data.schedules.push(`${this.commonText.schedule.weekday.replace('%s',this.commonText.weekday[scheduleValue])}`);
                } else if(schedule.type == 'biweek') {
                    const scheduleValue: string = schedule.value as string;
                    const matches: RegExpMatchArray | null = scheduleValue.match(/(\d)-(\d)/);
                    if(matches) {
                        const weekday = matches[1];
                        const turn: string = this.locale === 'en-US' ? get_num_sufix(Number(matches[2])) : matches[2];
                        trash_data.schedules.push(this.commonText.schedule.biweek.replace('%s1',turn).replace('%s2',this.commonText.weekday[weekday]));
                    }
                } else if(schedule.type == 'month') {
                    const scheduleValue: string = schedule.value as string;
                    trash_data.schedules.push(`${this.commonText.schedule.weekday.replace('%s',this.commonText.weekday[scheduleValue])}`);
                    const day = this.locale === 'en-US' ? get_num_sufix(Number(scheduleValue)) : scheduleValue;
                    trash_data.schedules.push(`${this.commonText.schedule.month.replace('%s',day)}`);
                } else if(schedule.type == 'evweek') {
                    const scheduleValue: EvweekValue = schedule.value as EvweekValue;
                    trash_data.schedules.push(`${this.commonText.schedule.evweek.replace('%s',this.commonText.weekday[scheduleValue.weekday])}`);
                }
            });
            return_data.push(trash_data);
        });
        return return_data;
    }

    get registerd_card_title(): string {
        return this.localeText.card.registerd_title;
    }

    getRegisterdContentForCard(schedule_data: TrashDataText[]): string {
        let card_text = '';
        schedule_data.forEach((data) => {
            card_text += `${data.typeText}: ${data.schedules.join(this.localeText.separate)}\n`;
        });

        return card_text;
    }
}