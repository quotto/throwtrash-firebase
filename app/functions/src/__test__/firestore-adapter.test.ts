import firebase = require("firebase-admin");
firebase.initializeApp({
    credential: firebase.credential.applicationDefault()
});
const firestore = firebase.firestore();
import crypto = require("crypto");
import { FirestoreAdapter } from "../firestore-adapter";
import { TrashData } from "trash-common";

const firestore_adapter = new FirestoreAdapter();

describe("getUserIDByAccessToken",()=>{
    const userid0001 = "userid0001";
    const accesstoken001 = "accesstoken001";
    const hashkey001 = crypto.createHash("sha512").update(accesstoken001).digest("hex");

    const userid0002 = "userid0002";
    const accesstoken002 = "accesstoken002";
    const hashkey002 = crypto.createHash("sha512").update(accesstoken002).digest("hex");
    beforeAll(async()=>{
       const batch:FirebaseFirestore.WriteBatch = firestore.batch();
       const data001 = firestore.collection("throwtrash-backend-accesstoken").doc(hashkey001);
       const data002 = firestore.collection("throwtrash-backend-accesstoken").doc(hashkey002);
       batch.set(data001,{user_id: userid0001, expires_in: 99999999999});
       batch.set(data002,{user_id: userid0002, expires_in: 10});
       await batch.commit();
    });
    
    test("valid data",async()=>{
        const result = await firestore_adapter.getUserIDByAccessToken(accesstoken001);
        expect(result).toBe(userid0001);
    });
    test("expired data",async()=>{
        try {
            await firestore_adapter.getUserIDByAccessToken(accesstoken002)
        } catch(err) {
            expect(true);
        }
    });
    test("no registered user",async()=>{
        const result = await firestore_adapter.getUserIDByAccessToken("no_registered_id");
        expect(result).toBe("");
    });

    afterAll(async()=>{
        const batch:FirebaseFirestore.WriteBatch = firestore.batch();
        batch.delete(firestore.collection("throwtrash-backend-accesstoken").doc(hashkey001));
        batch.delete(firestore.collection("throwtrash-backend-accesstoken").doc(hashkey002));
        await batch.commit();
    })
});

describe("getTrashSchedule",()=>{
    const userid0001 = "userid0001";
    const data001: {data: TrashData[]} = {data: [
        {type: "burn",schedules: [{type: "weekday", value: "0"},{type:"month",value: "12"}]},
        {type: "other",trash_val: "生ゴミ",schedules: [{type: "biweek", value: "1-3"},{type:"evweek",value: {start: "2020-5-3", weekday: "1"}}]}
    ]};
    beforeAll(async()=>{
        await firestore.collection("schedule").doc(userid0001).set(data001);
    });
    test("valid data",async()=>{
        const result = await firestore_adapter.getTrashSchedule(userid0001);
        expect(result).toMatchObject(data001.data);
    });
    test("no registered user",async()=> {
        const result = await firestore_adapter.getTrashSchedule("no_registered_id");
        expect(result.length).toBe(0);
    });

    afterAll(async()=>{
        await firestore.collection("schedule").doc(userid0001).delete();
    });
})