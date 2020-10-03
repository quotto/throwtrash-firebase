// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

import functions = require('firebase-functions');
import {dialogflow, DialogflowConversation, Contexts, GoogleCloudDialogflowV2WebhookRequest} from 'actions-on-google';

// process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
import admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

// Clientモジュールで使用するAPIのURLをNode.jsの環境変数として設定する
process.env.MecabAPI_URL=functions.config().mecab.url;
const app = dialogflow({debug: functions.config().run.mode!="PRODUCTION"});

const PointDayValue: any = {
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

const TrashTypeValue: any = {
    "もえるごみ": {value: "burn"},
    "もえないごみ": {value: "unburn"},
    "プラスチック": {value: "plastic"},
    "ビン": {value: "bin"},
    "カン": {value: "can"},
    "ペットボトル": {value: "petbottle"},
    "古紙": {value: "paper"},
    "資源ごみ": {value: "resource"},
    "粗大ごみ": {value: "coarse"},
}

import {client,TrashTypeValue} from "trash-common";

import {FirestoreAdapter} from "./firestore-adapter";

const textCreator = new client.TextCreator("ja-JP");
const service = new client.TrashScheduleService("Asia/Tokyo", textCreator, new FirestoreAdapter());

app.intent('GetTrashes',async(conv: DialogflowConversation<unknown,unknown,Contexts>,params: any) => {
    console.info(params);
    console.debug(JSON.stringify(conv));

    const targetDaySlotValue: string = params['TargetDay'];
    if(conv.user.access.token) {
        const scheduleData = await service.getTrashData(conv.user.access.token);
        if(scheduleData.response && targetDaySlotValue in PointDayValue) { 
            const pointdayValue = PointDayValue[targetDaySlotValue];
            const enabledTrashTypeValue: TrashTypeValue[] = await service.checkEnableTrashes(scheduleData.response,pointdayValue.value);
            const pointday = PointDayValue[targetDaySlotValue].type === "date" ? pointdayValue.value : pointdayValue.value + 3;
            const speechOut = textCreator.getPointdayResponse(pointday.toString(), enabledTrashTypeValue);
            conv.ask(speechOut + textCreator.getMessage("NOTICE_CONTINUE"));
            return;
        }
    }
    conv.ask(textCreator.getMessage("ERROR_UNKNOWN"));
});

app.intent("GetDayByTrashType", async(conv: DialogflowConversation<unknown,unknown,Contexts>, params: any)=>{
    console.info(params);
    console.debug(JSON.stringify(conv));

    const targetTrashType: string = params.TrashType;
    const scheduleData = await service.getTrashData(conv.user.access.token as string);
    if(scheduleData.response && targetTrashType in TrashTypeValue) {
        const trashType: string = TrashTypeValue[targetTrashType].value;
        const recentDate: client.RecentTrashDate[] = await service.getDayByTrashType(scheduleData.response,trashType);

        const contextParams = (conv.body as GoogleCloudDialogflowV2WebhookRequest )?.queryResult?.outputContexts;
        const trashName: string = (contextParams && contextParams.length >0 && contextParams[0].parameters) ? contextParams[0].parameters["TrashType.original"] : trashType;
        const speechOut = textCreator.getDayByTrashTypeMessage({type: trashType, name: trashName}, recentDate);

        conv.ask(speechOut + textCreator.getMessage("NOTICE_CONTINUE"));
        return;
    }
    conv.ask(textCreator.getMessage("ERROR_UNKNOWN"));
});

app.intent("GetDayByOtherTrash", async(conv: DialogflowConversation<unknown,unknown,Contexts>, params: any)=>{
    console.info(params);
    console.debug(JSON.stringify(conv));

    const targetTrashName: string = params.TrashName;
    const scheduleData = await service.getTrashData(conv.user.access.token as string);
    if(scheduleData.response && targetTrashName) {
        const recentDate: client.RecentTrashDate[] = await service.getDayByTrashType(scheduleData.response, "other");

        const matchTask: Array<Promise<void>> = []; 
        const matchTrash: Array<client.RecentTrashDate> = []; 
        recentDate.forEach((recentTrashDate: client.RecentTrashDate)=>{
            matchTask.push(
                service.compareTwoText(targetTrashName, recentTrashDate.key as string).then(score => {
                    if (score > 0.6) {
                        matchTrash.push(recentTrashDate);
                    }
                }).catch(err=> {
                    console.error(err);
                })
            );
        });
        

        await Promise.all(matchTask);
        const speechOut = textCreator.getDayByTrashTypeMessage({type: "other", name: targetTrashName},matchTrash);

        conv.ask(speechOut + textCreator.getMessage("NOTICE_CONTINUE"));
        return;
    }
    conv.ask(textCreator.getMessage("ERROR_UNKNOWN"));
});
app.intent('Default Fallback Intent',(conv: DialogflowConversation<unknown,unknown,Contexts>) => {
    conv.ask(textCreator.getMessage("NOTICE_CONTINUE"));
});

export const throwtrashV1 = functions.region("asia-northeast1").https.onRequest(app);