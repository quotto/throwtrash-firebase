import {TrashSchedule} from "trash-common";
export interface TrashDataText {
    type: string,
    typeText: string,
    schedules: string[]
}

export interface RecentTrashDate {
    key: string,
    schedules: TrashSchedule[],
    list: Date[],
    recent: Date
}