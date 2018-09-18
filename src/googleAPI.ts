import { Meeting } from './domain/meeting';
import * as googleauth from 'google-auth-library';
import * as googleapis from 'googleapis';
import { MeetingRoom, ParseRoomCapacity } from './domain/meetingRoom';
import {GetGoogleClientSecret} from './utils';

const fs = require('fs');
const { google } = require('googleapis');

// If modifying these scopes, delete credentials.json
const SCOPES = ['https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly', 'https://www.googleapis.com/auth/calendar'];
let TOKEN_PATH = 'credentials.json';

export class GoogleApis {
    private static content = GetGoogleClientSecret();
    private static authClient: googleauth.OAuth2Client;

    static authorize() {
        let oAuth2Client = this.getAuthClient();
        
        //Check if we have previously stored a token.
        let token: any;
        try {
            token = fs.readFileSync(TOKEN_PATH, 'utf8');
            console.log(token);
        } catch (err) {
            // TODO: Handle error and prompt the user to refresh login token
            console.log(err);
            return undefined;
        }

        oAuth2Client.setCredentials(JSON.parse(token));
    }

    static getAuthClient() {
        if (this.authClient == undefined) {
            const { client_secret, client_id, redirect_uris } = this.content.web;
            this.authClient = new googleauth.OAuth2Client(client_id, client_secret, redirect_uris[0]);
        }
        return this.authClient;
    }

    static generateAuthUrl() {        
        let oAuth2Client = this.getAuthClient();

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        return authUrl;
    }

    static storeToken(token: any) {
        try {
            // fs.mkdirSync(TOKEN_DIR);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token));
            console.log('Token stored to ' + TOKEN_PATH);
        } catch (err) {
            if (err.code != 'EEXIST') {
                throw err;
            }
        }
    }

    static async listEvents(): Promise<googleapis.calendar_v3.Resource$Events> {
        let events = undefined;
        this.authorize();

        if (this.authClient != null && this.authClient != undefined) {
            const calendar = new googleapis.calendar_v3.Calendar({ auth: this.authClient });
            events = calendar.events;
        }
        else {
            console.log("Error auth");
        }

        return events;
    }

    static async addEvent(meeting: Meeting): Promise<any> {
        this.authorize();

        if (this.authClient != null && this.authClient != undefined) {
            const calendar = google.calendar({ version: 'v3', auth: this.authClient });

            var event = {
                'summary': meeting.subject,
                'location': meeting.location.name,
                'description': meeting.description,
                'start': {
                    'dateTime': meeting.starttime,
                    'timeZone': 'Europe/Copenhagen',
                },
                'end': {
                    'dateTime': meeting.endtime,
                    'timeZone': 'Europe/Copenhagen',
                },
                'attendees': meeting.attendees,
                'reminders': {
                    'useDefault': false,
                    'overrides': [
                        { 'method': 'email', 'minutes': 24 * 60 },
                        { 'method': 'popup', 'minutes': 10 },
                    ],
                },
            };

            return calendar.events.insert({
                auth: this.authClient,
                calendarId: 'primary',
                resource: event,
                sendNotifications: true,
            });
        }
    }

    static async fetchResources(): Promise<MeetingRoom[]> {
        let resources = undefined;
        let rooms: MeetingRoom[] = [];
        this.authorize();
        const service = google.admin('directory_v1');
        await service.resources.calendars.list({
            auth: this.authClient,
            customer: 'my_customer',
        })
        .then((response: any) => {
            resources = response.data.items;
            console.log('Resources:');
            for (let i = 0; i < resources.length; i++) {                
                const resource = resources[i];
                console.log('%s (%s)', resource.resourceName, resource.resourceType);
                let room = new MeetingRoom();
                room.name = resource.generatedResourceName;
                room.location = resource.buildingId;
                room.mail = resource.resourceEmail;
                if(String(resource.resourceType).match('Mødelokale') != null) {
                    room.capacity = ParseRoomCapacity(resource.resourceName);
                } else {
                    room.capacity = 0;
                }
                rooms.push(room);
            }  
            return rooms;
        })
        .catch((error) => 
        {
            console.log('The API returned an error: ' + error);
                return undefined;
        });
        return rooms;
    }

    static async checkIfBusy(timemin: string, timemax: string, items: any[]): Promise<any> {
        this.authorize();
        let freebusy;
        if (this.authClient != null && this.authClient != undefined) {
            const calendar = new googleapis.calendar_v3.Calendar({ auth: this.authClient });
            await calendar.freebusy.query({
                auth: this.authClient,
                requestBody: {
                    timeMin: timemin,
                    timeMax: timemax,
                    items: items
                }
            }).then((response) => {
                freebusy = response.data.calendars;
            })
            .catch((error) => console.log(error));;
        }
        return freebusy;
    }
}