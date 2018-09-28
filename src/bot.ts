import * as builder from "botbuilder";
import { SaveBotToFile, SaveUserToFile, LoadBotsFromFile, LoadUsersFromFile } from "./botutils/fs_reader";
import { SlackIdentity } from "./botbuilder-slack/address";
import { GoogleApis, GoogleCredentials } from "./googleAPI";
import { GenerateEventMessageAttachment, GenerateLocationSelectionAttachment, GenerateRoomSelectionMenuAttachment, GenerateConfirmMeetingAttachement } from "./botutils/slack_message_builder";
import { MeetingRoom } from "./domain/meetingRoom";

export type BotCache = { [key: string]: { identity: builder.IIdentity, token: string } }
export type UserCache = { [key: string]: { identity: SlackIdentity, credentials?: GoogleCredentials } }

export class SlackBot {
  private recognizer: builder.LuisRecognizer;
  private bot: builder.UniversalBot;
  public currentSession: builder.Session;
  private userCache: UserCache;
  private meetingRooms: MeetingRoom[];

  constructor(connector: builder.IConnector, botsCache: BotCache, usersCache: UserCache, luisURI: string) {
    this.createBot(connector, botsCache, usersCache, luisURI);
    this.userCache = usersCache;
  }

  createBot(connector: builder.IConnector, botsCache: BotCache, usersCache: UserCache, luisURI: string) {
    //Connect to LUIS and create intent <-> dialog mapping
    this.recognizer = new builder.LuisRecognizer(luisURI);

    //Intent dialog mapping based on the recognizer settings
    let intents = new builder.IntentDialog({ recognizers: [this.recognizer] })
      .matches('Greeting', (session, dialogArgs) => session.beginDialog('GreetingDialog', dialogArgs))
      .matches('Calendar.Add', (session, dialogArgs) => session.beginDialog('AddAppointmentDialog', dialogArgs))
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

    this.bot.on('channel_join', (event: builder.IEvent) => {
      console.info(`New conversation update event received:`);
      console.info(event);
    });

    this.bot.dialog('commandtest', this.TestDialog());
    this.bot.dialog('GreetingDialog', this.GreetingDialog());
    this.bot.dialog('AppInstalledDialog', this.AppInstalledDialog());
    this.bot.dialog('GoogleLoginDialog', this.PromptGoogleLoginDialog());
    this.bot.dialog('GetApointmentsDialog', this.GetApointmentsDialog());
    this.bot.dialog('AddAppointmentDialog', this.AddCalendarAppointmentDialog())
      .cancelAction('cancelAction', "Ok, canceling create appointment", {
        matches: /^cancel|abort|stop|start over/i
      })
      .endConversationAction('endConversationAction', "Ok, canceling create appointment", {
        matches: /^cancel|abort|stop|start over/i
      });

    this.bot.on('slackCommand', (event: builder.IEvent) => {
      console.info(`New slack command received:`)
      console.info(event)

      const commandName = event.sourceEvent.SlackMessage.command
      const dialogName = commandName.split("/")[1];
      this.bot.beginDialog(event.address, dialogName);
    });

    this.bot.dialog('/', intents);
  }

  TestDialog() {
    return [
      (session: builder.Session, dialogArgs: builder.IIntentRecognizerResult, next: (res?: builder.IDialogResult<string>) => void) => {
        session.endConversation('This is a test!');
      }
    ];
  }

  GreetingDialog() {
    return [
      (session: builder.Session, dialogArgs: builder.IIntentRecognizerResult, next: (res?: builder.IDialogResult<string>) => void) => {
        let username = (session.message.address.user as SlackIdentity).fullname;
        session.endConversation('Nice to meet you, ' + username + "!");
      }
    ];
  }

  AppInstalledDialog() {
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

  PromptGoogleLoginDialog() {
    return [
      (session: builder.Session, dialogArgs: any) => {
        let url = GoogleApis.generateAuthUrl();
        this.currentSession = session;
        session.send("Hello there! This is HAL9000 meeting assistant. Please allow HAL9000 to use your google calendar. \n" + "<" + url + "|Google Login Link>");
      }
    ]
  }

  GetApointmentsDialog() {
    return [
      async (session: builder.Session, dialogArgs: builder.IIntentRecognizerResult, next: (res?: builder.IDialogResult<string>) => void) => {
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

  AddCalendarAppointmentDialog() {
    return [
      // Build up session data
      async (session: builder.Session, dialogArgs: builder.IIntentRecognizerResult, next: (res?: builder.IDialogResult<string>) => void) => {
        //Store address in conversation, for later use
        session.conversationData.sourceAddress = session.message.address;
        let user = this.getUserFromCache(session.message.address.user.id);
        session.dialogData.user = user;
        session.dialogData.meeting = {};
        session.dialogData.meeting.attendees = [];
        // session.dialogData.meeting.attendees.push({'email': this.userEmail});
        if (dialogArgs != undefined) {
          if (dialogArgs.entities) {
            for (let entity of dialogArgs.entities) {
              switch (entity.type) {
                case "builtin.datetimeV2.datetimerange":
                  {
                    var daterange = builder.EntityRecognizer.findEntity(dialogArgs.entities, 'builtin.datetimeV2.datetimerange') as any;
                    console.log(daterange.resolution.values);
                    if (daterange.resolution.values && daterange.resolution.values.length > 0) {
                      session.dialogData.meeting.starttime = new Date(daterange.resolution.values[0].start);
                      session.dialogData.meeting.endtime = new Date(daterange.resolution.values[0].end);
                    }
                  }
                  break;
                case "builtin.datetimeV2.datetime":
                  {
                    const dt_datetime = builder.EntityRecognizer.parseTime(entity.entity);
                    session.dialogData.meeting.starttime = dt_datetime;
                    console.log(dt_datetime);
                  }
                  break;
                case "builtin.datetimeV2.date":
                  {
                    const dt_datetime = builder.EntityRecognizer.parseTime(entity.entity);
                    dt_datetime.setHours(8);
                    session.dialogData.meeting.starttime = dt_datetime
                    console.log(dt_datetime);
                  }
                  break;
                case "Calendar.Location":
                  {
                    let location = entity.entity;
                    session.dialogData.meeting.location = location;
                  }
                  break;
                case "Calendar.Subject":
                  {
                    let subject = entity.entity;
                    session.dialogData.meeting.subject = subject;
                  }
                  break;
                case "builtin.email": {
                  session.dialogData.meeting.attendees.push({ 'email': entity.entity });
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
        }
        console.log(dialogArgs);
        //MEETING.STARTTIME
        if (!session.dialogData.meeting.starttime) {
          builder.Prompts.time(session, 'When do you want to schedule your meeting? (example: tomorrow at 10am; today 8 - 9; today from 15 to 17)');
        }
        else {
          next();
        }
      },
      (session: builder.Session, result: builder.IPromptTimeResult, next: (res?: builder.IDialogResult<Date>) => void) => {
        // Save MEETING.STARTTIME and ENDTIME if the response is not empty                 
        if (result.response) {
          let eventScheduledEntity = result.response as any;
          console.log(eventScheduledEntity);
          if (eventScheduledEntity.resolution) {
            if (eventScheduledEntity.resolution.start) {
              session.dialogData.meeting.starttime = new Date(eventScheduledEntity.resolution.start);
            }

            if (eventScheduledEntity.resolution.end) {
              session.dialogData.meeting.endtime = new Date(eventScheduledEntity.resolution.end);
            }
          }
          else {
            let startdate = builder.EntityRecognizer.resolveTime([result.response]);
            session.dialogData.meeting.starttime = startdate;
          }
        }

        //MEETING.ENDTIME
        if (!session.dialogData.meeting.endtime) {
          builder.Prompts.time(session, 'When is the meeting going to end?');
        }
        else {
          next();
        }
      },
      (session: builder.Session, result: builder.IPromptTimeResult, next: (res?: builder.IDialogResult<Date>) => void) => {
        // Save MEETING.ENDTIME if the response is not empty
        if (result.response) {
          let endtime = builder.EntityRecognizer.resolveTime([result.response])
          session.dialogData.meeting.endtime = endtime;
        }

        //MEETING.SUBJECT
        if (!session.dialogData.meeting.subject) {
          builder.Prompts.text(session, 'What is the subject of the meeting?');
        }
        else {
          next();
        }
      },
      (session: builder.Session, result: builder.IPromptTextResult, next: (res?: builder.IDialogResult<Date>) => void) => {
        // Save MEETING.SUBJECT if the response is not empty
        if (result.response) {
          session.dialogData.meeting.subject = result.response;
        }
        //Ask the user for meeting location
        if (!session.dialogData.meeting.location) {
          //builder.Prompts.choice(session, "Select location for your meeting", "aarhus | ballerup | none", { listStyle: builder.ListStyle.button} );
          // session.beginDialog('LocationAnswerDialog');
          var message = new builder.Message();
          message.addAttachment(GenerateLocationSelectionAttachment());
          builder.Prompts.text(session, message)
        }
        else {
          next();
        }
      },
      async (session: builder.Session, result: any, next: (res?: builder.IDialogResult<Date>) => void) => {
        if (result.response != 'none') {
          // Show all available rooms for the selected timestamp and location ARH | B2C
          await this.promptAvailableRoomsSelectionMessage(session, result.response)
        }
        else {
          session.dialogData.meeting.location = '';
          next();
        }
      },
      (session: builder.Session, result: any, next: (res?: builder.IDialogResult<Date>) => void) => {
        // Save MEETING.LOCATION if the response is not empty
        if (result.response) {
          var selectedRoomArray = this.meetingRooms.filter(room => room.name.match(result.response));
          if (selectedRoomArray.length > 0) {
            let locationText = selectedRoomArray[0].name;
            let roomMail = selectedRoomArray[0].mail;
            session.dialogData.meeting.location = locationText;
            session.dialogData.meeting.attendees.push({ 'email': roomMail });
          }
          else {
            console.log('Error: Could not find rooms called: ' + result.response);
          }
        }

        session.dialogData.meeting.description = "This is a test meeting made from HAL9000 Meeting assistant.";
        var message = new builder.Message();
        message.addAttachment(GenerateConfirmMeetingAttachement(session.dialogData.meeting));
        builder.Prompts.text(session, message)
      },
      async (session: builder.Session, result: any, next: (res?: builder.IDialogResult<Date>) => void) => {
        if (result.response === 'yes') {
          // Create new google calendar event with the data from the meeting
          await GoogleApis.addEvent(session.dialogData.meeting, session.dialogData.user.credentials).
            then((res) => this.showNewEvent(res, session))
            .catch((err) => console.log(err));
        }
        else {
          session.endConversation("The event was NOT added to your calendar");
        }
      },
    ];
  }

  async filterResources(startTime, endTime, location, attendees, credentials): Promise<MeetingRoom[]> {
    // filter the list of meeting rooms by location ARH | B2C and capacity, order by capacity
    let filteredRooms = this.meetingRooms.filter(meetingRoom => meetingRoom.capacity > 0 && meetingRoom.name.match(location) != null && meetingRoom.capacity >= attendees).sort((m1, m2) => { return m1.capacity - m2.capacity });
    // Check for availability googleapi.freebusy the filtered results
    let items = [];
    filteredRooms.forEach(room => {
      items.push({ id: room.mail })
    });
    let freeRooms: MeetingRoom[] = [];
    await GoogleApis.checkIfBusy(credentials, startTime, endTime, items).then((response) => {
      if (response) {
        const freebusyArray = Object.keys(response).map(i => response[i]);
        var i;
        for (i = 0; i < freebusyArray.length; i++) {
          if (freebusyArray[i].busy.length == 0) {
            freeRooms.push(filteredRooms[i]);
          };
        }

        return freeRooms;
      }
    })
      .catch((error) => console.log(error));
    return freeRooms;
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
      var message = new builder.Message();
      events.map((event, i) => {
        message.addAttachment(GenerateEventMessageAttachment(event));
        console.log(event.summary)
      });

      session.send(message);
      session.endConversation("");
    }
    else {
      console.log('No upcoming events found.');
      session.endConversation(user.identity.name + ", it seems like you dont have any events in the requested period");
    }
  }

  // checkMiracleDomain(): boolean {
  // if(this.userEmail != undefined) 
  // {
  //     return this.userEmail.endsWith('@miracle.dk');
  // }
  // else
  // {
  //     return false;
  // }
  //   return false;
  // }

  async promptAvailableRoomsSelectionMessage(session: builder.Session, location: string): Promise<void> {
    // Get the dialogArgs here
    let startTime = session.dialogData.meeting.starttime;
    let endTime = session.dialogData.meeting.endtime;
    let attendees = session.dialogData.meeting.attendees;
    let office = location === 'aarhus' ? 'ARH' : 'B2C';
    if (this.meetingRooms == undefined || this.meetingRooms.length == 0) {
      this.meetingRooms = await GoogleApis.fetchResources(session.dialogData.user.credentials);
        // .then((response) => {
        //   // Store the resources
        //   this.setResources(response);
        // }).catch((error) => console.log(error));

    }

    // Filter the available rooms
    let filteredRooms: MeetingRoom[] = await this.filterResources(startTime, endTime, office, attendees, session.dialogData.user.credentials);
      // .then((result) => filteredRooms = result)
      // .catch();

    var message = new builder.Message();
    if (filteredRooms && filteredRooms.length > 0) {
      message.addAttachment(GenerateRoomSelectionMenuAttachment(filteredRooms));
    }

    builder.Prompts.text(session, message);
  }

  setResources(roomsList: MeetingRoom[]) {
    this.meetingRooms = roomsList;
  }

  storeToken(code: string) {
    var oauth2Client = GoogleApis.getAuthClient();
    oauth2Client.getToken(code).then((token) => {
      if (this.currentSession != undefined) {
        this.currentSession.endDialogWithResult({ response: token.tokens });
      }
    }).catch((error) => {
      console.log('Google token generated error: ' + error);
    });
  }

  getUserFromCache(userId: string) {
    var userId = userId.split(':')[0];
    var user = this.userCache[userId];
    // TODO: Figure out what happens if for some reason the user is not found in the cache
    return user;
  }

  showNewEvent(response, session: builder.Session) {
    console.log(response.data);
    var message = new builder.Message();
    message.addAttachment(GenerateEventMessageAttachment(response.data, true));
    session.send(message);
    session.endConversation("");
  }
}