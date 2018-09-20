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
      .matches('Calendar.Find', (session, dialogArgs) => session.beginDialog('GetApointmentsDialog', dialogArgs))
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
    this.bot.dialog('GetApointmentsDialog', this.getGetApointmentsDialog());

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
          var user = this.getUserFromCache(session.message.address.user.id);
          user.credentials = token.response;
          SaveUserToFile(user);
          session.endConversation('Done!');
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
        session.send("Hello there! This is HAL9000 meeting assistant. Please allow HAL9000 to use your google calendar. \n" + "<" + url + "|Google Login Link>");
      }
    ]
  }

  getGetApointmentsDialog() {
    return [
      async (session: builder.Session, dialogArgs: builder.IIntentRecognizerResult, next: (res?: builder.IDialogResult<string>) => void) => {
        //Store address in conversation, for later use
        // let filter = {
        //   calendarId: 'primary',
        //   timeMin: (new Date().toISOString()),
        //   maxResults: 10,
        //   singleEvents: true,
        //   orderBy: 'startTime',
        // }
        session.conversationData.sourceAddress = session.message.address;
        let user = this.getUserFromCache(session.message.address.user.id);
        session.dialogData.user = user;
        session.dialogData.searchParams = {};
        session.dialogData.searchParams.calendarId = 'primary';
        session.dialogData.searchParams.singleEvents = true;
        session.dialogData.searchParams.orderBy = 'startTime';

        if (dialogArgs != undefined) {
          if (dialogArgs.entities) {
            for (let entity of dialogArgs.entities) {
              switch (entity.type) {
                case "builtin.datetimeV2.datetimerange":
                  {
                    var daterange = builder.EntityRecognizer.findEntity(dialogArgs.entities, 'builtin.datetimeV2.datetimerange') as any;
                    console.log(daterange.resolution.values);
                    if (daterange.resolution.values && daterange.resolution.values.length > 0) {
                      session.dialogData.searchParams.timeMin = new Date(daterange.resolution.values[0].start);
                      session.dialogData.searchParams.timeMax = new Date(daterange.resolution.values[0].end);
                    }
                  }
                  break;
                case "builtin.datetimeV2.daterange":
                  {
                    var daterange = builder.EntityRecognizer.findEntity(dialogArgs.entities, 'builtin.datetimeV2.daterange') as any;
                    console.log(daterange.resolution.values);
                    if (daterange.resolution.values && daterange.resolution.values.length > 0) {
                      let start = new Date(daterange.resolution.values[0].start);
                      let end = new Date(daterange.resolution.values[0].end);
                      start.setHours(0);
                      end.setHours(0);
                      session.dialogData.searchParams.timeMin = start;
                      session.dialogData.searchParams.timeMax = end;
                    }
                  }
                  break;
                case "builtin.datetimeV2.datetime":
                  {
                    let dt_datetime = builder.EntityRecognizer.parseTime(entity.entity);
                    session.dialogData.searchParams.timeMin = dt_datetime;
                    session.dialogData.searchParams.timeMax = dt_datetime;
                    console.log(dt_datetime);
                  }
                  break;
                case "builtin.datetimeV2.date":
                  {
                    let dt_datetimeEnd = builder.EntityRecognizer.parseTime(entity.entity);
                    let dt_datetimeStart = builder.EntityRecognizer.parseTime(entity.entity);

                    dt_datetimeEnd.setHours(23);
                    dt_datetimeEnd.setMinutes(59);
                    session.dialogData.searchParams.timeMax = dt_datetimeEnd;

                    dt_datetimeStart.setHours(0);
                    dt_datetimeStart.setMinutes(0);
                    session.dialogData.searchParams.timeMin = dt_datetimeStart;
                  }
                  break;
                case "Calendar.Location":
                  {
                    // let location = entity.entity;
                  }
                  break;
                case "Calendar.Subject":
                  {
                    // let subject = entity.entity;
                  }
                  break;
                case "builtin.email": {
                  // let email = entity.entity;
                }
                  break;
                case "Communication.ContactName": {
                  // TODO: Figure out a way to search the name in the contacts list and try to add the email to the session.dialogData.meeting.attendees list
                  // let name = entity.entity;
                }
                  break;
                default: break;
              }
            }
          }

          if (session.dialogData.searchParams.timeMin == undefined) {
            session.dialogData.searchParams.timeMin = (new Date().toISOString())
          }

          if (session.dialogData.searchParams.timeMax == undefined) {
            session.dialogData.searchParams.maxResults = 10;
          }
        }
        this.listEvents(session, session.dialogData.searchParams, session.dialogData.user);
      }
    ];
  }

  async listEvents(session: builder.Session, searchParams: any, user: any) {
    let events;
    await GoogleApis.listEvents(user.credentials).then((response) => events = response).catch((error) => console.log(error));
    events.list(searchParams)
      .then((response) => this.displayEvents(response, session, user))
      .catch((err) => {
        console.log('The API returned an error: ' + err);
        session.endConversation("I am sorry, " + user.identity.name + "... System error.");
      });
  }

  displayEvents(response: any, session: builder.Session, user: any) {
    const events = response.data.items;
    if (events.length) {
        // let meetingsDoc = new Document();
        // meetingsDoc.paragraph().text("Here is what I found in your calendar, " + user.identity.name);
        events.map((event, i) => {
            //  this.generateEventApplicationCard(event, meetingsDoc);       
            console.log(event.summary)
        });

        // session.send(<builder.IMessage>(({
        //     textFormat: 'json',
        //     value: meetingsDoc.toJSON()
        // }) as any));

        session.endConversation("");
    }
    else {
        console.log('No upcoming events found.');
        session.endConversation(user.identity.name + ", it seems like you dont have any events in the requested period");
    }        
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

  getUserFromCache(userId: string) {
    var userId = userId.split(':')[0];
    var user = this.userCache[userId];
    // TODO: Figure out what happens if for some reason the user is not found in the cache
    return user;
  }
}