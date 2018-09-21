import * as cardbuilder from "adaptivecards";

// export function GenerateEventInfoAttachment(event: any): IAttachment  {
//     let dateStart;
//     let dateEnd;
//     let durationText = "";
//     if (event.start.dateTime) {
//         let format = { hour: '2-digit', minute: '2-digit' };
//         dateStart = new Date(event.start.dateTime);
//         dateEnd = new Date(event.end.dateTime);
//         durationText = dateStart.toLocaleDateString('dk-DA') + " " + dateStart.toLocaleTimeString('dk-DA', format) + " - " + dateEnd.toLocaleTimeString('dk-DA', format);
//     }
//     else {
//         dateStart = new Date(event.start.date);
//         dateEnd = new Date(event.end.date);
//         durationText = dateStart.toLocaleDateString('dk-DA') + " - " + dateEnd.toLocaleDateString('dk-DA');
//     }

//     // let message = new Message();
//     // let attachment = new AttachmentType();
//     // message.addAttachment()
//     // let attachment: IAttachment = AttachmentType {
//     //     contentType = "application/vnd.microsoft.card.adaptive",
//     //     content = {

//     //     }

//     // }
//     return undefined;
// }

export function GenerateEventAttachement(event: any): any {
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
    
    var title: cardbuilder.TextBlock = new cardbuilder.TextBlock() 
    title.text = event.summary;
    title.size = cardbuilder.TextSize.Large;
    

    var duration: cardbuilder.TextBlock = new cardbuilder.TextBlock();
    duration.text = durationText;
    duration.size = cardbuilder.TextSize.Default;
    duration.weight = cardbuilder.TextWeight.Bolder
    
    var card = {
        type: "AdaptiveCard",
        body: [
            title,
            duration
        ],
        actions: [] 
    }

    var attachment = {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card
    }

    return attachment;
}

export interface AdaptiveCard {
    type: "AdaptiveCard",
    body?: (cardbuilder.TextBlock | cardbuilder.Image | cardbuilder.ImageSet | cardbuilder.FactSet | cardbuilder.ColumnSet | cardbuilder.Container)[],
    actions?: (cardbuilder.SubmitAction | cardbuilder.OpenUrlAction | cardbuilder.ShowCardAction)[];
}


