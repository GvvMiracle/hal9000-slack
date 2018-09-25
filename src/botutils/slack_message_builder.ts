import { MessageAttachment } from "@slack/client";
import { IAttachment } from "botbuilder";

export function GenerateEventMessageAttachment(event: any): IAttachment {
    let dateStart;
    let dateEnd;
    let durationText = "";
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
        fields: [
            {
                title: "Duration",
                value: durationText,
                short: false
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


