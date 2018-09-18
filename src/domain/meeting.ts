import { MeetingRoom } from "./meetingRoom";

export interface Meeting {
    subject: string;
    starttime: Date;
    endtime: Date;
    location: MeetingRoom;
    duration: string;
    description: string;
    isRepeat: boolean;
    attendees: string[];
}