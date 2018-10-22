import { Meeting } from './domain/meeting';
import * as googleauth from 'google-auth-library';
import * as googleapis from 'googleapis';
import { MeetingRoom, ParseRoomCapacity } from './domain/meetingRoom';
import {GetGoogleClientSecret} from './botutils/fs_reader';
import { TokenInfo } from 'google-auth-library/build/src/auth/oauth2client';

const { google } = require('googleapis');

// If modifying these scopes, need to get new authentication token from google apis
const SCOPES = ['profile', 'email', 'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly', 'https://www.googleapis.com/auth/calendar'];

export class GoogleApis {
    private static content = GetGoogleClientSecret();
    private static authClient: googleauth.OAuth2Client;

    static authorize(credentials: GoogleCredentials) {
        let oAuth2Client = this.getAuthClient();
        oAuth2Client.setCredentials(credentials);
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

    static async listEvents(credentials: GoogleCredentials): Promise<googleapis.calendar_v3.Resource$Events> {
        let events = undefined;
        this.authorize(credentials);

        if (this.authClient != null && this.authClient != undefined) {
            const calendar = new googleapis.calendar_v3.Calendar({ auth: this.authClient });
            events = calendar.events;
        }
        else {
            console.log("Error auth");
        }

        return events;
    }

    static async addEvent(meeting: Meeting, credentials: GoogleCredentials): Promise<any> {
        this.authorize(credentials);

        if (this.authClient != null && this.authClient != undefined) {
            const calendar = google.calendar({ version: 'v3', auth: this.authClient });

            var event = {
                'summary': meeting.subject,
                'location': meeting.location.name,
                'description': meeting.description,
                'start': {
                    'dateTime': meeting.starttime
                },
                'end': {
                    'dateTime': meeting.endtime
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

    static async fetchResources(credentials: GoogleCredentials): Promise<MeetingRoom[]> {
        let resources = undefined;
        let rooms: MeetingRoom[] = [];
        this.authorize(credentials);
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
                let room: MeetingRoom = {
                    name: resource.generatedResourceName,
                    location: resource.buildingId,
                    mail: resource.resourceEmail,
                    capacity: 0
                }
                
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

    static async checkIfBusy(credentials: GoogleCredentials, timemin: string, timemax: string, items: any[]): Promise<any> {
        this.authorize(credentials);
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

export interface GoogleCredentials {
    access_token? : string;
    scope? : string;
    token_type? : string;
    expity_date? : string;
}

export interface GoogleTokenExtraInfo extends TokenInfo  {
    email?: string,
    email_verified?: boolean,
}