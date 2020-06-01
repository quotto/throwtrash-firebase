import {TrashData} from "trash-common";
export interface DBAdapter {
    getUserIDByAccessToken(access_token: string): Promise<string>; 
    getTrashSchedule(user_id: string): Promise<TrashData[]>; 
}