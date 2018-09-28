import { MessageAttachment } from "@slack/client";
import { IAttachment } from "botbuilder";
import { MeetingRoom } from "../domain/meetingRoom";

export function GenerateEventMessageAttachment(event: any, createEvent: boolean = false): IAttachment {
    let dateStart;
    let dateEnd;
    let durationText = "";
    let pretext = ""
    if (createEvent) {
        pretext = "New event was added to your calendar";
    }

    if (event.start.dateTime) {
        let format = { hour: '2-digit', minute: '2-digit' };
        dateStart = new Date(event.start.dateTime);
        dateEnd = new Date(event.end.dateTime);
        durationText = dateStart.toLocaleDateString('dk-DA') + " " + dateStart.toLocaleTimeString('dk-DA', format) + " - " + dateEnd.toLocaleTimeString('dk-DA', format);
    }
    else {
        dateStart = new Date(event.start.date);
        dateEnd = new Date(event.end.date);
        durationText = dateStart.toLocaleDateString('dk-DA') + " - " + dateEnd.toLocaleDateString('dk-DA');
    }

    let attachment: MessageAttachment = {
        fallback: "",
        title: event.summary,
        title_link: event.htmlLink,
        pretext: pretext,
        fields: [
            {
                title: "Duration",
                value: durationText,
                short: true
            },
            {
                title: "Location",
                value: event.location || "N/A",
                short: false
            }
        ]
    }

    return {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: attachment
    };
}

export function GenerateLocationSelectionAttachment(): IAttachment {
    let text = "Choose location of your meeting"
    let attachment: MessageAttachment = {
        fallback: "",
        text: text,
        callback_id: 'prompt_location',
        attachment_type: 'default',
        actions: [
            {
                name: "location",
                text: "Aarhus",
                type: "button",
                value: "aarhus"
            },
            {
                name: "location",
                text: "B2C",
                type: "button",
                value: "ballerup"
            },
            {
                name: "location",
                text: "None",
                type: "button",
                value: "none"
            },
        ]
    }

    return {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: attachment
    };
}

export function GenerateRoomSelectionMenuAttachment(rooms: MeetingRoom[]): IAttachment {
    let text = "Select meeting room";
    let actions: any[] = [];
    rooms.forEach(room => {
        actions.push(
            {
                name: "room",
                text: room.name,
                type: "button",
                value: room.name
            })
    });

    let attachment: MessageAttachment = {
        fallback: "",
        text: text,
        callback_id: 'prompt_room_selection',
        attachment_type: 'default',
        actions: actions
    }

    return {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: attachment
    };
}

export function GenerateConfirmMeetingAttachement(meeting: any): IAttachment {
    // let starttime = '';
    // let endtime = '';
    let text = 'Confirm meeting';
    let attachment: MessageAttachment = {
        fallback: "",
        pretext: text,
        callback_id: 'prompt_meeting_confirm',
        attachment_type: 'default',
        fields: [
            {
                title: "Subject",
                value: meeting.subject,
                short: false
            },
            {
                title: "Location",
                value: meeting.location,
                short: false
            },
            {
                title: "Starts",
                value: meeting.starttime,
                short: false
            },
            {
                title: "Ends",
                value: meeting.endtime,
                short: false
            },
            {
                title: "Attendees",
                value: "",
                short: false
            }
        ],
        actions: [
            {
                name: "confirm",
                text: "Yes",
                type: "button",
                value: "yes"
            },
            {
                name: "confirm",
                text: "No, cancel process",
                type: "button",
                value: "no"
            }]
        }

    return {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: attachment
    };
}