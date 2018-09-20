import * as builder from "botbuilder";
import { SaveBotToFile, SaveUserToFile, LoadBotsFromFile, LoadUsersFromFile } from "./utils";
import { SlackIdentity } from "./botbuilder-slack/address";
import { GoogleApis, GoogleCredentials } from "./googleAPI";

export type BotCache = { [key: string]: { identity: builder.IIdentity, token: string } }
export type UserCache = { [key: string]: { identity: SlackIdentity, credentials?: GoogleCredentials } }

export class SlackBot {
  private recognizer: builder.LuisRecognizer;
  private bot: builder.UniversalBot;
  public currentSession: builder.Session;
  private userCache: UserCache;

  constructor(connector: builder.IConnector, botsCache: BotCache, usersCache: UserCache, luisURI: string) {
    this.createBot(connector, botsCache, usersCache, luisURI);
    this.userCache = usersCache;
  }  

  createBot(connector: builder.IConnector, botsCache: BotCache, usersCache: UserCache, luisURI: string) {
    //Connect to LUIS and create intent <-> dialog mapping
    this.recognizer = new builder.LuisRecognizer(luisURI);

    //Intent dialog mapping based on the recognizer settings
    let intents = new builder.IntentDialog({ recognizers: [this.recognizer] })
      .matches('Greeting', (session, dialogArgs) => session.beginDialog('GetGreetingDialog', dialogArgs))
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

    // Load stored bots and user info
    LoadBotsFromFile(botsCache);
    LoadUsersFromFile(usersCache);

    this.bot.on('installationUpdate', (event: builder.IEvent) => {
      console.info(`New bot installed by ${event.sourceEvent.SlackMessage.user_id}`)
      console.log(event);
      botsCache[event.sourceEvent.SlackMessage.team_id] = {
        identity: event.address.bot,
        token: event.sourceEvent.ApiToken
      };

      usersCache[event.sourceEvent.SlackMessage.user_id] = {
        identity: event.address.user
      };

      // Save to file when new bot or and user is found
      SaveBotToFile(botsCache[event.sourceEvent.SlackMessage.team_id]);
      SaveUserToFile(usersCache[event.sourceEvent.SlackMessage.user_id]);
      this.bot.beginDialog(event.address, 'AppInstalledDialog');
    });

    this.bot.on('conversationUpdate', (event: builder.IEvent) => {
      console.info(`New conversation update event received:`);
      console.info(event);
    });

    this.bot.dialog('commandtest', this.getTestDialog());
    this.bot.dialog('GetGreetingDialog', this.getGreetingDialog());
    this.bot.dialog('AppInstalledDialog', this.getAppInstalledDialog());
    this.bot.dialog('GoogleLoginDialog', this.getPromptGoogleLoginDialog());

    this.bot.on('slackCommand', (event: builder.IEvent) => {
      console.info(`New slack command received:`)
      console.info(event)

      const commandName = event.sourceEvent.SlackMessage.command
      const dialogName = commandName.split("/")[1];
      this.bot.beginDialog(event.address, dialogName);
    });
    
    this.bot.dialog('/', intents);
  }

  getTestDialog() {
    return [
      (session: builder.Session, dialogArgs: builder.IIntentRecognizerResult, next: (res?: builder.IDialogResult<string>) => void) => {
        session.endConversation('This is a test!');
      }
    ];
  }

  getGreetingDialog() {
    return [
      (session: builder.Session, dialogArgs: builder.IIntentRecognizerResult, next: (res?: builder.IDialogResult<string>) => void) => {
        let username = (session.message.address.user as SlackIdentity).fullname;
        session.endConversation('Nice to meet you, ' + username + "!");
      }
    ];
  }

  getAppInstalledDialog() {
    return [
      (session: builder.Session, dialogArgs: any) => {
        session.beginDialog('GoogleLoginDialog');
      },
      (session: builder.Session, result: builder.IDialogResult<GoogleCredentials>) => {
        if (result.response) {
          var token = result;
          // Save token to the user cache
          var userId = session.message.address.user.id.split(':')[0];
          var user = this.userCache[userId];
          user.credentials = token.response;
          SaveUserToFile(user);
          // Prompt the user help message
        }
      }
    ];
  }

  getPromptGoogleLoginDialog() {
    return [
      (session: builder.Session, dialogArgs: any) => {
        let url = GoogleApis.generateAuthUrl();
        this.currentSession = session;
        session.send("Hello there! This is HAL9000 meeting assistant. Please allow HAL9000 to use your google calendar. \n" + "<" + url + ">");
      }
    ]
  }

  checkMiracleDomain(): boolean {
    // if(this.userEmail != undefined) 
    // {
    //     return this.userEmail.endsWith('@miracle.dk');
    // }
    // else
    // {
    //     return false;
    // }
    return false;
  }

  storeToken(code: string) {
    var oauth2Client = GoogleApis.getAuthClient();
    oauth2Client.getToken(code).then((token) => {
      if (this.currentSession != undefined) {
        this.currentSession.endDialogWithResult({ response: token.tokens });
      }
    }).catch((error) => {
      console.log('Google token generate error: ' + error);
    });
  }

  async handleGoogleTokenSaved() {
    // // Get resources
    // if (this.checkMiracleDomain()) {
    //   await GoogleApis.fetchResources()
    //     .then((response) => {
    //       // Store the resources
    //       this.setResources(response);

    //       // Send help message to the user
    //       this.bot.beginDialog((<ConversationAddress>{
    //         cloudId: this.cloudId,
    //         conversationId: this.conversationId,
    //         clientId: this.clientId,
    //         bot: {
    //           id: 'your-bot-id',
    //           name: 'Your Bot Name'
    //         },
    //         channelId: 'stride',
    //         user: {
    //           id: this.userId
    //         },
    //         conversation: {
    //           id: this.conversationId + this.userId,
    //           isGroup: true
    //         }
    //       }), 'HelpDialog');
    //     })
    //     .catch((error) => console.log(error));
    // }
  }
}