import common = require("trash-common");
const logger = common.getLogger();
logger.setLevel_DEBUG();

import rp = require('request-promise');
import firebase_admin = require("firebase-admin");
firebase_admin.initializeApp({
    credential: firebase_admin.credential.applicationDefault()
})
import {TrashData,TrashTypeValue} from "trash-common";

import {TextCreator} from "../common/text-creator";
import {FirestoreAdapter} from "../firestore-adapter";

import { RecentTrashDate } from '../common/domain';
import { DBAdapter } from '../common/db-adapter';

import testData = require("./testdata.json");
const locale_list = ['ja-JP', 'en-US'];
const localeText: any={}, commonText: any={}, displayText: any={};
locale_list.forEach(locale=>{
    localeText[locale] = require(`../common/template_text/${locale}.text.json`);
    commonText[locale] = require(`../common/template_text/${locale}.common.json`);
    displayText[locale] = require(`../common/template_text/${locale}.display.json`);
});

import {Client} from "../client";


describe('en-US',function(){
    it('checkEnableTrashes',async()=>{
        const client = new Client('America/New_York', new TextCreator('en-US'), new FirestoreAdapter());
        // Date.UTCのMonthは0始まり
        Date.now = jest.fn().mockReturnValue(Date.UTC(2018,2,1,5,0,0,0));
        const testdata = [{ 'type': 'burn', 'trash_val': '', 'schedules': [{ 'type': 'weekday', 'value': '3' }, { 'type': 'weekday', 'value': '6' }, { 'type': 'none', 'value': '' }] }, { 'type': 'plastic', 'trash_val': '', 'schedules': [{ 'type': 'weekday', 'value': '1' }, { 'type': 'none', 'value': '' }, { 'type': 'none', 'value': '' }] }, { 'type': 'paper', 'trash_val': '', 'schedules': [{ 'type': 'none', 'value': '' }, { 'type': 'biweek', 'value': '1-2' }, { 'type': 'none', 'value': '' }] }, { 'type': 'plastic', 'trash_val': '', 'schedules': [{ 'type': 'weekday', 'value': '4' }, { 'type': 'none', 'value': '' }, { 'type': 'none', 'value': '' }] }, { 'type': 'petbottle', 'trash_val': '', 'schedules': [{ 'type': 'weekday', 'value': '4' }, { 'type': 'month', 'value': '11' }, { 'type': 'none', 'value': '' }] }];

        const result = await client.checkEnableTrashes(testdata,0);
        expect(result.length).toBe(2);
        expect((<TrashTypeValue[]>result)[0].name).toBe('plastic');
        expect((<TrashTypeValue[]>result)[1].name).toBe('plastic bottle');
    });
});

describe('calculateLocalTime',()=>{
    beforeAll(()=>{
        Date.now = jest.fn().mockReturnValue(1554298037605);
    });
    it('calculateTime',()=>{
        let dt;
        let client;
        client = new Client('America/Denver', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(7);

        client = new Client('America/Boise', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(7);

        client = new Client('America/Phoenix', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(6);

        client = new Client('America/Los_Angeles', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(6);

        client = new Client('America/Chicago', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(8);

        client = new Client('America/Indiana/Indianapolis', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(9);

        client = new Client('America/Detroit', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(9);

        client = new Client('America/New_York', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(9);

        client = new Client('America/Anchorage', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(5);

        client = new Client('Pacific/Honolulu', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(3);


        client = new Client('Asia/Tokyo', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(22);


        client = new Client('utc', new TextCreator('en-US'),new FirestoreAdapter());
        dt = client.calculateLocalTime(0);
        expect(dt.getHours()).toBe(13);
    });
});

describe('ja-JP',function(){
    const client = new Client("Asia/Tokyo", new TextCreator("ja-JP"), new FirestoreAdapter());
    let nict_data: any;
    beforeAll(async()=>{
        await rp.get('https://ntp-a1.nict.go.jp/cgi-bin/json').then((data)=>{
            nict_data = JSON.parse(data);
        });
        Date.now = jest.fn().mockReturnValue(new Date().getTime());
    });
    describe('calculateLocalTime',function(){
        it('今日の日付',function(){
            const ans = new Date(nict_data.st * 1000 + (9*60*60*1000));
            const dt:Date = client.calculateLocalTime(0);
            expect(dt.getDate()).toBe(ans.getUTCDate());
            expect(dt.getDay()).toBe(ans.getUTCDay());
        });

        it('明日の日付',function(){
            const ans = new Date(nict_data.st * 1000 + (9*60*60*1000));
            ans.setSeconds(ans.getSeconds()+(24*60*60));
            const dt = client.calculateLocalTime(1);
            expect(dt.getDate()).toBe(ans.getUTCDate());
            expect(dt.getDay()).toBe(ans.getUTCDay());
        });
    });

    describe('checkEnableTrashes',function(){
        it('weekday',async()=>{
            Date.now = jest.fn().mockReturnValue(Date.UTC(2018,1,28,15,0,0,0));
            const result = await client.checkEnableTrashes(testData.checkEnableTrashes,0) as TrashTypeValue[];
            expect(result.length).toBe(2);
            expect(result[0].name).toBe("資源ゴミ");
            expect(result[1].name).toBe("ペットボトル");

        });
        it('biweek',async()=>{
            Date.now = jest.fn().mockReturnValue(Date.UTC(2018,2,11,15,0,0,0));
            const result = await client.checkEnableTrashes(testData.checkEnableTrashes, 0) as TrashTypeValue[];
            expect(result.length).toBe(2);
            expect(result[0].name).toBe('プラスチック');
            expect(result[1].name).toBe('古紙');
        });
        it('month',async()=>{
            Date.now = jest.fn().mockReturnValue(Date.UTC(2018,2,10,15,0,0,0));
            const result = await client.checkEnableTrashes(testData.checkEnableTrashes, 0) as TrashTypeValue[];
            expect(result.length).toBe(1);
            expect(result[0].name).toBe('ペットボトル');
        });
        it('evweek',async()=>{
            Date.now = jest.fn().mockReturnValue(Date.UTC(2018,8,25,15,0,0,0));

            /**
             * テストデータの想定(testdata.jsonのevweek)
             * 1.曜日が一致し該当週のため対象
             * 2.曜日が一致し該当週のため対象(年をまたいだ隔週判定)
             * 3.該当集だが曜日が一致しないので対象外
             * 4.登録週=今週かつ曜日が一致のため対象
             * 5.翌週が該当週のため対象外
             * 6.前週が該当のため対象外
             * 7.4週間前のため一致
             */
            const result = await client.checkEnableTrashes(testData.evweek, 0) as TrashTypeValue[];
            expect(result.length).toBe(4);
            expect(result[0].name).toBe("もえるゴミ");
            expect(result[1].name).toBe("もえないゴミ");
            expect(result[2].name).toBe("プラスチック");
            expect(result[3].name).toBe("ビン");
        });
        it('none',async()=>{
            Date.now = jest.fn().mockReturnValue(Date.UTC(2018,2,3,15,0,0,0));

            const result = await client.checkEnableTrashes(testData.checkEnableTrashes,0);
            expect(result.length).toBe(0);
        });
    });
    describe('checkEnableTrashes duplicate 重複排除機能',function(){
        it('重複の排除',async()=>{
            Date.now = jest.fn().mockReturnValue(Date.UTC(2018,8,28,15,0,0,0));

            const response = await client.checkEnableTrashes(testData.duplicate,0);
            expect(response.length).toBe(1);
        });
        it('otherの場合はtrash_valが同じ場合のみ重複排除',async()=>{
            Date.now = jest.fn().mockReturnValue(Date.UTC(2018,7,25,15,0,0,0));

            const response = await client.checkEnableTrashes(testData.duplicate_other,0) as TrashTypeValue[];
            expect(response.length).toBe(2);
            expect(response[0].name).toBe("廃品");
            expect(response[1].name).toBe("発泡スチロール");
        });
    });
    describe('getTargetDayByWeekday',function(){
        beforeAll(()=>{
            Date.now = jest.fn().mockReturnValue(Date.UTC(2019,2,16,15,0,0,0));
        });
        it('日曜日',function(){
            const target_day = client.getTargetDayByWeekday(0);
            expect(target_day).toBe(7);
        });
        it('月曜日',function(){
            const target_day = client.getTargetDayByWeekday(1);
            expect(target_day).toBe(1);
        });
        it('土曜日',function(){
            const target_day = client.getTargetDayByWeekday(6);
            expect(target_day).toBe(6);
        });
    });

    describe('calculateNextDayBySchedule',()=>{
        const today = new Date('2019/11/27'); //水曜日
        it('weekday:当日',()=>{
            const next_dt = client.calculateNextDateBySchedule(today, 'weekday', '3')
            expect(next_dt.getDate()).toBe(27);
        });
        it('weekday:同じ週',()=>{
            const next_dt = client.calculateNextDateBySchedule(today, 'weekday', '6')
            expect(next_dt.getDate()).toBe(30);
        });
        it('weekday:次の週',()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019//11/20'), 'weekday', '2')
            expect(next_dt.getDate()).toBe(26);
        });
        it('weekday:月替り',()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019//11/27'), 'weekday', '2')
            expect(next_dt.getMonth()).toBe(11);
            expect(next_dt.getDate()).toBe(3);
        });

        it('month:当日',()=>{
            const next_dt = client.calculateNextDateBySchedule(today, 'month', "27");
            expect(next_dt.getDate()).toBe(27);
        });
        it('month:同じ月',()=>{
            const next_dt = client.calculateNextDateBySchedule(today, 'month', "29");
            expect(next_dt.getDate()).toBe(29);
        });
        it('month:月替り',()=>{
            const next_dt = client.calculateNextDateBySchedule(today, 'month', "1");
            expect(next_dt.getMonth()).toBe(11);
            expect(next_dt.getDate()).toBe(1);
        });

        it('biweek:当日',()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019/11/22'), 'biweek', '5-4');
            expect(next_dt.getDate()).toBe(22);

        });
        it('biweek:同じ週',()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019/11/22'), 'biweek', '6-4');
            expect(next_dt.getDate()).toBe(23);
        });
        it('biweek:次の週',()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019/11/22'), 'biweek', '0-4');
            expect(next_dt.getDate()).toBe(24);
        });
        it('biweek月替り',()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019/11/22'), 'biweek', '0-1');
            expect(next_dt.getMonth()).toBe(11);
            expect(next_dt.getDate()).toBe(1);
        });

        it('evweek:当日', ()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019/11/22'), 'evweek', {start: '2019-11-17',weekday: '5'});
            expect(next_dt.getDate()).toBe(22);
        })
        it('evweek:同じ週', ()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019/11/21'), 'evweek', {start: '2019-11-3',weekday: '5'});
            expect(next_dt.getDate()).toBe(22);
        });
        it('evweek:次の週', ()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019/11/21'), 'evweek', {start: '2019-11-10',weekday: '5'});
            expect(next_dt.getDate()).toBe(29);
        });
        it('evweek:開始が未来日', ()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019/11/21'), 'evweek', {start: '2019-11-24',weekday: '5'});
            expect(next_dt.getDate()).toBe(29);
        });
        it('evweek:月替り', ()=>{
            const next_dt = client.calculateNextDateBySchedule(new Date('2019/11/21'), 'evweek', {start: '2019-11-17',weekday: '1'});
            expect(next_dt.getMonth()).toBe(11);
            expect(next_dt.getDate()).toBe(2);
        });
    })

    describe('getDayByTrashType',()=>{
        describe('weekday',()=>{
            const trashes = [
                {
                    type: 'burn',
                    schedules: [
                        {type:'weekday',value: '0'},
                        {type:'weekday',value: '6'},
                    ]
                }
            ];
            it('当日が日曜日',()=>{
                Date.now = jest.fn().mockReturnValue(Date.UTC(2019,2,16,15,0,0,0));
                const result: RecentTrashDate[] = client.getDayByTrashType(trashes,'burn');
                console.log(JSON.stringify(result,null,2));
                expect(result[0].list[0].getDate()).toBe(17);
                expect(result[0].list[1].getDate()).toBe(23);
                expect(result[0].recent.getDate()).toBe(17);
            });
            it('当日が金曜日',()=>{
                Date.now = jest.fn().mockReturnValue(Date.UTC(2019,2,14,15,0,0,0));
                const result = client.getDayByTrashType(trashes,"burn");
                expect(result[0].list[0].getDate()).toBe(17);
                expect(result[0].list[1].getDate()).toBe(16);
                expect(result[0].recent.getDate()).toBe(16);
            });
        });
        describe("month",()=>{
            beforeAll(()=>{
                Date.now = jest.fn().mockReturnValue(Date.UTC(2019,1,14,15,0,0,0));
            });
            it("翌月1日設定/同月追加/同月追加後の翌月/同日",()=>{
                const trashes = [
                    {
                        type: "burn",
                        schedules: [
                            {type: 'month',value: "1"},
                            {type: 'month',value: "17"},
                            {type: 'month',value: "31"},
                            {type: 'month',value: "15"}
                        ]
                    }
                ];
                const result = client.getDayByTrashType(trashes,"burn");
                expect(result[0].list[0].getMonth()+1).toBe(3);
                expect(result[0].list[1].getMonth()+1).toBe(2);
                expect(result[0].list[2].getMonth()+1).toBe(3);
                expect(result[0].list[3].getMonth()+1).toBe(2);
                expect(result[0].recent.getDate()).toBe(15);
            });
        });
        describe("biweek",()=>{ 
            it("第n曜日が一致する日にちでの計算",()=>{
                Date.now = jest.fn().mockReturnValue(Date.UTC(2019,2,12,15,0,0,0));
                const trashes = [
                    {
                        type: "burn",
                        schedules: [
                            { type: "biweek", value: "3-2" }, //当日
                            { type: "biweek", value: "3-3" }, //1週間後
                            { type: "biweek", value: "4-2" }, //同じ週の後ろの曜日
                            { type: "biweek", value: "4-3" }, //1週間後の後ろの曜日
                            { type: "biweek", value: "2-3" }, //1週間後の前の曜日
                            { type: "biweek", value: "1-1" }  //翌月
                        ]
                    }
                ];
                const result = client.getDayByTrashType(trashes, "burn");
                expect(result[0].list[0].getDate()).toBe(13);
                expect(result[0].list[1].getDate()).toBe(20);
                expect(result[0].list[2].getDate()).toBe(14);
                expect(result[0].list[3].getDate()).toBe(21);
                expect(result[0].list[4].getDate()).toBe(19);
                expect(`${result[0].list[5].getMonth() + 1}-${result[0].list[5].getDate()}`).toBe("4-1");
                expect(result[0].recent.getDate()).toBe(13);
            });
            it("同じ週に第n曜日が一致しない後ろの曜日での計算",()=>{
                Date.now = jest.fn().mockReturnValue(Date.UTC(2019,2,12,15,0,0,0));
                const trashes = [
                    {
                        type: "burn",
                        schedules: [
                            { type: "biweek", value: "5-3" }, //同じ週で回数が多い曜日
                            { type: "biweek", value: "5-4" }, //1週間後で回数が多い曜日
                            { type: "biweek", value: "5-2" }  //回数が既に終わっている曜日
                        ]
                    }
                ];
                const result = client.getDayByTrashType(trashes, "burn");
                expect(result[0].list[0].getDate()).toBe(15);
                expect(result[0].list[1].getDate()).toBe(22);
                expect(`${result[0].list[2].getMonth() + 1}-${result[0].list[2].getDate()}`).toBe("4-12");
                expect(result[0].recent.getDate()).toBe(15);
            });
            it("同じ週に第n曜日が一致しない前の曜日での計算",()=>{
                Date.now = jest.fn().mockReturnValue(Date.UTC(2019,2,14,15,0,0,0));
                const trashes = [
                    {
                        type: "burn",
                        schedules: [
                            { type: "biweek", value: "4-3" }, //1週間後で回数が少ない曜日
                        ]
                    }
                ];
                const result = client.getDayByTrashType(trashes, "burn");
                expect(result[0].list[0].getDate()).toBe(21);
                expect(result[0].recent.getDate()).toBe(21);
            });
        });
        describe("evweek",()=>{
            beforeAll(()=>{
                Date.now = jest.fn().mockReturnValue(Date.UTC(2019,2,14,15,0,0,0));
            });
            it("今週/翌週/当日",()=>{
                const trashes = [
                    {
                        type: "burn",
                        schedules: [
                            {type: "evweek",value:{weekday: "6",start:"2019-02-24"}},
                            {type: "evweek",value:{weekday: "6",start:"2019-03-03"}},
                            {type: "evweek",value:{weekday: "5",start:"2019-03-10"}}
                        ]
                    }
                ];
                const result = client.getDayByTrashType(trashes,"burn");
                expect(result[0].list[0].getDate()).toBe(16);
                expect(result[0].list[1].getDate()).toBe(23);
                expect(result[0].list[2].getDate()).toBe(15);
                expect(result[0].recent.getDate()).toBe(15);
            });
        });
        describe('nomatch',()=>{
            it('該当するごみが登録されていない',()=>{
                const trashes = [
                    {
                        type: 'burn',
                        schedules: [{type: 'weekday',value:'0'}]
                    }
                ];
                const result = client.getDayByTrashType(trashes,'unburn');
                expect(result.length).toBe(0);
            });
        });
        describe('other match',()=>{
            beforeAll(()=>{
                Date.now = jest.fn().mockReturnValue(Date.UTC(2019,2,14,15,0,0,0));
            });
            it('複数のother登録',()=>{
                const trashes = [
                    { type: 'other', trash_val: '金属', schedules: [{type: 'weekday',value:'5'},{type: 'month',value:'30'}] },
                    { type: 'other', trash_val: 'リソース', schedules: [{type: 'weekday',value:'5'},{type: 'month',value:'30'}] }
                ];
                const result = client.getDayByTrashType(trashes,'other');
                console.log(result);
                expect(result[0].list.length).toBe(2);
                expect(result[0].key).toBe("金属");
                expect(result[0].list[0].getDate()).toBe(15);
                expect(result[0].recent.getDate()).toBe(15);
                expect(result[1].list.length).toBe(2);
                expect(result[1].key).toBe("リソース");
                expect(result[1].list[0].getDate()).toBe(15);
                expect(result[1].recent.getDate()).toBe(15);
            });
        });
    });
});

describe('getRemindBody',()=>{
    const client = new Client("Asia/Tokyo",new TextCreator("ja-JP"),new FirestoreAdapter());
    describe('thisweek', ()=>{
        it('sunday', async()=>{
            Date.now = jest.fn().mockReturnValue(1564892787630); //2019/8/4
            const result_list = await client.getRemindBody(0, testData.reminder);
            expect(result_list.length).toBe(6);
            expect(result_list[2].body[0].type).toBe("burn");
            expect(result_list[5].body[0].type).toBe("other");
        });
        it('saturday', async()=>{
            Date.now = jest.fn().mockReturnValue(1565362800000); //2019/8/10
            const result_list = await client.getRemindBody(0, testData.reminder);
            expect(result_list.length).toBe(0);
        });
    });
    describe('nextweek', ()=>{
        it('sunday', async()=>{
            Date.now = jest.fn().mockReturnValue(1564892787630); //2019/8/4
            const result_list = await client.getRemindBody(1, testData.reminder);
            expect(result_list.length).toBe(7)
            expect(result_list[0].body[0].type).toBe("burn");
            expect(result_list[0].body[1].type).toBe("can");
            expect(result_list[3].body[0].type).toBe("burn");
            expect(result_list[6].body.length).toBe(0);
        });
        it('saturday',async()=>{
            Date.now = jest.fn().mockReturnValue(1565362800000); //2019/8/10
            const result_list = await client.getRemindBody(1, testData.reminder);
            expect(result_list.length).toBe(7);
            expect(result_list[0].body[0].type).toBe("burn");
            expect(result_list[0].body[1].type).toBe("can");
            expect(result_list[3].body[0].type).toBe("burn");
            expect(result_list[6].body.length).toBe(0);
        });
    })
});

describe('getTrashData', function () {
    const access_token_001 = "abcd989049AsdjfdALJD0j-sdfadshfF";
    const id_001 = "10b38bbe-8a0f-4afc-afa9-c00aaac1d1de";

    // 存在しないアクセストークン
    const access_token_002 = "bbbbbbbbb";
    
    // 旧型のアクセストークン
    const access_token_003 = "10b38bbe-8a0f-4afc-afa9-c00aaac1d1df";

    // 存在しないuser_idを返すアクセストークン
    const access_token_004 = "fc-afa9-c00aaac1d1df";

    // 存在しないuser_id
    const id_002 = "20b38bbe-8a0f-4afc-afa9-c00aaac1d1df";

    // DB異常を起こすIDのアクセストークン
    const access_token_005 = "aaaaaaaaaaaabbbbd";


    class TestDBAdapter implements DBAdapter {
        getUserIDByAccessToken(access_token: string): Promise<string> {
            if(access_token === access_token_001) {
                return new Promise((resolve,reject)=>{resolve(id_001)});
            }  else if(access_token === access_token_002) {
                return new Promise((resolve,reject)=>{resolve("")});
            } else if(access_token === access_token_004) {
                return new Promise((resolve,reject)=>{resolve(id_002)});
            } else if(access_token === access_token_005) {
                return new Promise((resolve,reject)=>{resolve("failed_id")});
            }
            throw new Error("Method not implemented.");
        }
        getTrashSchedule(user_id: string): Promise<TrashData[]> {
            if(user_id === id_001 || user_id === access_token_003) {
                return new Promise((resolve,reject)=>{resolve(testData.evweek)});
            } else if(user_id === id_002) {
                return new Promise((resolve,reject)=>{resolve([])});
            }
            throw new Error("Method not implemented.");
        }
    }

    const client = new Client("Asia/Tokyo", new TextCreator("ja-JP"), new TestDBAdapter());
    it('正常データ', async()=>{
            const result = await client.getTrashData(access_token_001);
            expect(result.status).toBe("success");
            expect(result.response).toMatchObject(testData.evweek);
    });
    it('正常データ（旧タイプ）', async()=>{
        // 生アクセストークンが36桁の場合はそのままTrashScheduleを検索する
        const result = await client.getTrashData(access_token_003);
        expect(result.status).toBe("success");
        expect(result.response).toMatchObject(testData.evweek);
    });
    it('存在しないアクセストークン', async()=> {
        const result = await client.getTrashData(access_token_002);
        expect(result.status).toBe("error");
        expect(result.msgId).toBe("id_not_found_error");
    });
    it('存在しないID', async()=> {
        const result = await client.getTrashData(access_token_004);
        expect(result.status).toBe("error");
        expect(result.msgId).toBe("id_not_found_error");
    });
    it('アクセストークン取得でDB異常', async()=> {
        const result = await client.getTrashData("failed_token");
        expect(result.status).toBe("error");
        expect(result.msgId).toBe("general_error");
    });
    it('スケジュール取得でDB異常', async()=> {
        const result = await client.getTrashData(access_token_005);
        expect(result.status).toBe("error");
        expect(result.msgId).toBe("general_error");
    });
});