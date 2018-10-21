// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

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

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const agent = new WebhookClient({ request, response });
    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

    //   function welcome(agent) {
    //     // Get the database collection 'dialogflow' and document 'agent' and store
    //     // the document  {entry: "<value of database entry>"} in the 'agent' document
    //     const dialogflowAgentRef = db.collection('dialogflow').doc('agent');
    //     return db.runTransaction(t => {
    //       t.set(dialogflowAgentRef, {id: '1234',value:'aaaaaaa'});
    //       return Promise.resolve('Write complete');
    //     }).then(doc => {
    //       agent.add(`Wrote to the Firestore database.`);
    //     }).catch(err => {
    //       console.log(`Error writing to Firestore: ${err}`);
    //       agent.add(`Failed to write to the Firestore database.`);
    //     });
    //   }

    function get_trashes(agent){
        const accessToken = agent.user.accessToken;
        db.collection('schedule').where('id','==',accessToken).get()
        .then(snapshot => {
            console.log(`${snapshot[0].id}:${snapshot[0].data}`);
            const targetDay = agent.parameters.targetDay;
            let result = 0;
            if(PointDayValue[targetDay].type === 'date') {
                result = Client.getEnableTrashes(snapshot[0].data,PointDayValue[targetDay].value)
            } else {
                result = Client.getEnableTrashesByWeekday(snapshot[0].data,PointDayValue[targetDay].value)
            }
            const speechOut = result.length > 0 ? `${targetDay}出せるゴミは${result.join('、')}、です。` : `${targetDay}出せるゴミはありません。`;
            agent.add(speechOut);
            return Promise.resolve(speecOut);
        }).catch(err => {
            console.log(err);
            agent.add('問題が発生しました。開発者へお問い合わせください。');
        })
    }

    function fallback(agent) {
        agent.add(`すみません、わかりません。`);
        agent.add(`もう一度言っていただけますか？`);
    }

    // // Uncomment and edit to make your own intent handler
    // // uncomment `intentMap.set('your intent name here', yourFunctionHandler);`
    // // below to get this function to be run when a Dialogflow intent is matched
    // function yourFunctionHandler(agent) {
    //   agent.add(`This message is from Dialogflow's Cloud Functions for Firebase editor!`);
    //   agent.add(new Card({
    //       title: `Title: this is a card title`,
    //       imageUrl: 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
    //       text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
    //       buttonText: 'This is a button',
    //       buttonUrl: 'https://assistant.google.com/'
    //     })
    //   );
    //   agent.add(new Suggestion(`Quick Reply`));
    //   agent.add(new Suggestion(`Suggestion`));
    //   agent.setContext({ name: 'weather', lifespan: 2, parameters: { city: 'Rome' }});
    // }

    // // Uncomment and edit to make your own Google Assistant intent handler
    // // uncomment `intentMap.set('your intent name here', googleAssistantHandler);`
    // // below to get this function to be run when a Dialogflow intent is matched
    // function googleAssistantHandler(agent) {
    //   let conv = agent.conv(); // Get Actions on Google library conv instance
    //   conv.ask('Hello from the Actions on Google client library!') // Use Actions on Google library
    //   agent.add(conv); // Add Actions on Google library responses to your agent's response
    // }
    // // See https://github.com/dialogflow/dialogflow-fulfillment-nodejs/tree/master/samples/actions-on-google
    // // for a complete Dialogflow fulfillment library Actions on Google client library v2 integration sample

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcome);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('GetTrashes',get_trashes);
    // intentMap.set('your intent name here', yourFunctionHandler);
    // intentMap.set('your intent name here', googleAssistantHandler);
    agent.handleRequest(intentMap);
});
