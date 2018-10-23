'use strict';

const JSTOffset = 60 * 9 * 60 * 1000; // JST時間を求めるためのオフセット

const TrashType = {
    burn : 'もえるゴミ',
    unburn: 'もえないゴミ',
    plastic: 'プラスチック',
    bottole: 'ビン<break time="1ms"/>カン',
    bin: 'ビン',
    can: 'カン',
    petbottle: 'ペットボトル',
    paper: '古紙',
    resource: '<say-as interpret-as="interjection">資源ゴミ</say-as>',
    coarse: '<say-as interpret-as="interjection">粗大ゴミ</say-as>'
};


/**
target_day: 対象とする日を特定するための値。0なら今日、1なら明日……となる。
**/
exports.calculateJSTTime = (target_day) => {
    var localdt = new Date(); // 実行サーバのローカル時間
    var jsttime = localdt.getTime() + (localdt.getTimezoneOffset() * 60 * 1000) + JSTOffset + (60 * 24 * 60 * 1000 * target_day);
    var dt = new Date(jsttime);
    return dt;
};

/**
曜日指定の取得
現在の曜日と指定の曜日からtarget_dayを算出してgetEnableTrashesを呼び出す
access_token: ユーザーを特定するためのuuid
weekday: 指定された曜日 0=日曜日 始まり
**/
exports.getEnableTrashesByWeekday = function(data,target_weekday) {
    const dt = this.calculateJSTTime(0);
    const now_weekday = dt.getDay();
    let target_day = target_weekday - now_weekday;
    //1より小さい場合は翌週分
    if(target_day < 1) {
        target_day += 7;
    }
    return this.getEnableTrashes(data,target_day);
};

/**
data:   JSON形式のパラメータ
target_day: チェックするn日目。0なら今日、1なら明日......
**/
exports.getEnableTrashes = function(data,target_day) {
    const result = [];
    const dt = this.calculateJSTTime(target_day);
    data.forEach((trash,index,arr) => {
        const trash_name = trash['type'] ==='other' ? trash['trash_val'] : TrashType[trash['type']];
        // const type =  trash['type']
        trash['schedules'].some(schedule => {
            if(schedule['type'] === 'weekday') {
                console.log(dt);
                if(Number(schedule['value']) === dt.getDay()) {
                    result.push(trash_name);
                    return true;
                }
            } else if(schedule['type'] === 'biweek') {
                var matches = schedule['value'].match(/(\d)-(\d)/);
                var weekday = matches[1];
                var turn = matches[2];

                // 現在何週目かを求める
                var nowturn = 0;
                var targetdate = dt.getDate();
                while(targetdate > 0) {
                    nowturn += 1;
                    targetdate -= 7;
                }

                if(Number(weekday) === dt.getDay() && Number(turn) === nowturn) {
                    result.push(trash_name);
                    return true;
                }
            } else if(schedule['type'] === 'month') {
                if(dt.getDate() === Number(schedule['value'])) {
                    result.push(trash_name);
                    return true;
                }
            } else if(schedule['type'] === 'evweek') {
                if(Number(schedule.value.weekday) === dt.getDay()) {
                    const start_dt = new Date(schedule.value.start);
                    start_dt.setHours(0);
                    start_dt.setMinutes(0);
                    start_dt.setSeconds(0);
                    start_dt.setMilliseconds(0);
                    console.log(start_dt);

                    // 今週の日曜日を求める
                    let current_dt = new Date(dt.toISOString());
                    current_dt.setHours(0);
                    current_dt.setMinutes(0);
                    current_dt.setSeconds(0);
                    current_dt.setMilliseconds(0);
                    current_dt.setDate(current_dt.getDate() - current_dt.getDay());
                    console.log(current_dt);

                    // 登録されている日付からの経過日数を求める
                    const past_date = (current_dt - start_dt) / 1000 / 60 / 60 / 24;
                    console.log(past_date);

                    // 差が0またはあまりが0であれば隔週に該当
                    if(past_date === 0 || (past_date / 7) % 2 === 0) {
                        result.push(trash_name);
                        return true;
                    }
                }
            }
        });
    });
    // 同名のゴミがあった場合に重複を排除する
    return result.filter((value,index,self)=>{
        return self.indexOf(value) === index;
    });
};
