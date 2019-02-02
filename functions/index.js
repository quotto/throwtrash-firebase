// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');

const {
    dialogflow,
    BasicCard,
    Button,
    RegisterUpdate,
    Suggestions,
    UpdatePermission
} = require('actions-on-google');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
const app = dialogflow({debug: true});

const PointDayValue = {
    '今日':{type:'date',value:0},
    '明日':{type:'date',value:1},
    '明後日':{type:'date',value:2},
    '日曜日':{type:'week',value:0},
    '月曜日':{type:'week',value:1},
    '火曜日':{type:'week',value:2},
    '水曜日':{type:'week',value:3},
    '木曜日':{type:'week',value:4},
    '金曜日':{type:'week',value:5},
    '土曜日':{type:'week',value:6}
};

const Client = require('./client.js');

app.intent('GetTrashes',(conv,params) => {
    const targetDay = params['TargetDay'];

    const userSchedule = db.collection('schedule').doc(accessToken);
    return db.runTransaction(t =>{
        return t.get(userSchedule)
        .then(doc => {
            const targetDay = agent.parameters.TargetDay;
            console.log(`targetDay:${targetDay}`);
            let result = 0;
            if(PointDayValue[targetDay].type === 'date') {
                result = Client.getEnableTrashes(doc.data().data,PointDayValue[targetDay].value);
            } else {
                result = Client.getEnableTrashesByWeekday(doc.data().data,PointDayValue[targetDay].value);
            }
            const speechOut = result.length > 0 ? `${targetDay}出せるゴミは、${result.join('、')}、です。` : `${targetDay}出せるゴミはありません。`;
            const dt = Client.calculateJSTTime(0);
            t.update(userSchedule,{lastused: dt});
            return Promise.resolve(speechOut);
        }).catch(err =>{
            return Promise.reject(err);
        });
    }).then(result =>{
        conv.ask(result + '他に知りたいゴミ出し予定はありますか？');
    }).catch(err => {
        console.log(err);
        conv.ask('問題が発生しました。開発者へお問い合わせください。');
    })
});

app.intent('Default Fallback Intent',(conv) => {
    conv.ask('すみません、わかりません。もう一度言っていただけますか？');
});

exports.aogTips = functions.https.onRequest(app);
