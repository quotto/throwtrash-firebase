/**
 * request-promiseをmockするため別ファイルでテストする
 */
import firebase_admin = require("firebase-admin");
firebase_admin.initializeApp({
    credential: firebase_admin.credential.applicationDefault()
})
import {TextCreator} from "../common/text-creator";
import {FirestoreAdapter} from "../firestore-adapter";

process.env.MecabAPI_URL = "https://example.com";
jest.mock("request-promise", ()=>async(option: any)=>{
    if(option.uri === process.env.MecabAPI_URL+"/compare") {
        if(option.qs.text1 === "資源ごみ" && option.qs.text2 === "資源ごみ") {
            return {
                score: 1.0
            }
        } 
    }
    throw new Error("request-promise error");
});
import {Client} from "../client";

describe('compareTwoText',()=>{
    const client = new Client("Asia/Tokyo", new TextCreator("ja-JP"), new FirestoreAdapter());
    it('正常データ',async()=>{
        const result = await client.compareTwoText('資源ごみ','資源ごみ');
        expect(result).toBe(1.0);
    });
    it('パラメータエラー', async()=>{
        try {
            await client.compareTwoText('','ビン');
        }catch(err){
            expect(true);
        }
    });
    it('APIエラー', async()=>{
        try {
            await client.compareTwoText('ペットボtる','ビン');
        }catch(err){
            expect(true);
        }
    });
});