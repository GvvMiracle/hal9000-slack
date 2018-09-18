import * as builder from "botbuilder";
import {SaveBotToFile, SaveUserToFile, LoadBotsFromFile, LoadUsersFromFile} from "./utils";

export type BotCache = { [key: string]: { identity: builder.IIdentity, token: string } }
export type UserCache = { [key: string]: { identity: builder.IIdentity }}

export class SlackBot {
  constructor(connector: builder.IConnector, botsCache: BotCache, usersCache: UserCache, luisURI: string) {
    this.createBot(connector, botsCache, usersCache, luisURI);
  }

  private recognizer: builder.LuisRecognizer;
  private bot: builder.UniversalBot;

  createBot(connector: builder.IConnector, botsCache: BotCache, usersCache: UserCache, luisURI: string) {
    //Connect to LUIS and create intent <-> dialog mapping
    this.recognizer = new builder.LuisRecognizer(luisURI);

    let intents = new builder.IntentDialog({ recognizers: [this.recognizer] })
        .matches('Greeting', (session, dialogArgs) =>  session.beginDialog('GetGreetingDialog', dialogArgs))
        // .matches('Calendar.Add', (session, dialogArgs) => {
        //     if(this.checkMiracleDomain())
        //     {
        //         session.beginDialog('AddAppointmentDialog', dialogArgs);
        //     } 
        //     else 
        //     {
        //         session.send( [ this.userName + ', please use miracle.dk account', 'I am sorry, ' + this.userName + '. You dont have access to that feature.' ] );
        //     }
        // })
        // .matches('Calendar.Find', (session, dialogArgs) => session.beginDialog('GetApointmentsDialog', dialogArgs))
        // .matches('Utilities.Help', (session) => {
        //     let doc = new Document({ version: 1 });
        //     doc.paragraph().text("Here's what you can say");
        //     doc.bulletList().textItem(" get my schedule");
        //     doc.bulletList().textItem(" add new event");

        //     session.send(<builder.IMessage>(({
        //         textFormat: 'json',
        //         value: <any>doc.toJSON()
        //     }) as any));

        //     session.send(<builder.IMessage>(({
        //         textFormat: 'json',
        //         value: this.actions.messageWithInlineActionGroup()
        //     }) as any));
        // })
        .onDefault((session) => {
            session.send(["Sorry, I do not understand this.", "Sorry, I can`t do this."]);
        });

    this.bot = new builder.UniversalBot(connector)

    LoadBotsFromFile(botsCache);
    LoadUsersFromFile(usersCache);    

    this.bot.on('installationUpdate', (event: builder.IEvent) => {
      console.info(`New bot installed by ${event.sourceEvent.SlackMessage.user_id}`)
      console.log(event);
      botsCache[event.sourceEvent.SlackMessage.team_id] = {
        identity: event.address.bot,
        token: event.sourceEvent.ApiToken
      }

      usersCache[event.sourceEvent.SlackMessage.user_id] = {
        identity: event.address.user
      };

      // Save to file when new bot or and user is found
      SaveBotToFile(botsCache[event.sourceEvent.SlackMessage.team_id]);
      SaveUserToFile(usersCache[event.sourceEvent.SlackMessage.user_id]);

    })

    this.bot.on('conversationUpdate', (event: builder.IEvent) => {
      console.info(`New conversation update event received:`)
      console.info(event)

      
    })

    this.bot.dialog('commandtest', this.getTestDialog());
    this.bot.dialog('GetGreetingDialog', this.getGreetingDialog());

    this.bot.on('slackCommand', (event: builder.IEvent) => {
      console.info(`New slack command received:`)
      console.info(event)
      
      const commandName = event.sourceEvent.SlackMessage.command
      const dialogName = commandName.split("/")[1];
      this.bot.beginDialog(event.address, dialogName);
    })

    // bot.dialog('/', (session) => {
    //   session.endDialog('pong' + ' (' + session.message.text + ')');
    // }) 
    
    this.bot.dialog('/', intents);
  }

  getTestDialog() {
      return [
        (session: builder.Session, dialogArgs: builder.IIntentRecognizerResult, next: (res?: builder.IDialogResult<string>) => void) => {
            // let username = "";
            // if (this.userName != undefined) {
            //     username = ', ' + this.userName;
            // }
            // session.endConversation('Nice to meet you' + username + '! :)');

            session.endConversation('This is a test!');
        }
    ];
  }

  getGreetingDialog() {
    return [
        (session: builder.Session, dialogArgs: builder.IIntentRecognizerResult, next: (res?: builder.IDialogResult<string>) => void) => {
            // let username = "";
            // if (this.userName != undefined) {
            //     username = ', ' + this.userName;
            // }
            // session.endConversation('Nice to meet you' + username + '! :)');
            session.endConversation('Nice to meet you! :)');
        }
    ];
}
}