import admin = require('firebase-admin');
import {TrashData} from "trash-common";
import {DBAdapter} from "./common/db-adapter";

const db = admin.firestore();
import crypto = require("crypto");


const TRASH_SCHEDULE_COLLECTION = "schedule";
const ACCESS_TOKEN_COLLECTION = "throwtrash-backend-accesstoken";
export class FirestoreAdapter implements DBAdapter {
    public getUserIDByAccessToken(access_token:string):Promise<string> {
        const hashkey = crypto.createHash("sha512").update(access_token).digest("hex");
        const accessToken = db.collection(ACCESS_TOKEN_COLLECTION).doc(hashkey);
        return accessToken.get().then((doc:FirebaseFirestore.DocumentSnapshot) => {
            const data: FirebaseFirestore.DocumentData | undefined = doc.data();
            const currentTime = Math.ceil(Date.now() / 1000);
            if(doc.exists && data) {
                if(data.expires_in > currentTime) {
                    return data.user_id ;
                } else {
                    console.error(`AccessToken is expired -> accesstoken=${access_token},expire=${data.expires_in}`);
                }
            }
            console.error(`AccessToken is not found -> accesstoken=${access_token}`)
            // IDが見つからない場合はブランクを返す
            return "";
        }).catch((err:Error)=>{
            console.error(err);
            throw new Error("Failed getUserIDByAccessToken");
        });
    }

    public getTrashSchedule(user_id: string): Promise<Array<TrashData>> {
        const userSchedule = db.collection(TRASH_SCHEDULE_COLLECTION).doc(user_id);
        return userSchedule.get().then((doc: FirebaseFirestore.DocumentSnapshot) => {
            const data = doc.data();
            if(doc.exists && data) {
                return data.data as TrashData[];
            }
            console.error(`TrashSchedules is not found -> user_id=${user_id}`);
            // スケジュールが見つからない場合は空の配列を返す
            return [];
        }).catch((err:Error)=>{
            console.error(err);
            throw new Error("Failed getTrashSchedule");
        });
    }
}