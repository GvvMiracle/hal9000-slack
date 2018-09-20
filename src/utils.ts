import { UserCache, BotCache } from "./bot";

const fs = require('fs');
var rootDir = './.data/db/';

export function LoadUsersFromFile(usersCache: UserCache)  {
    
    try {
        const usersFolder = 'users/';
        fs.readdirSync(rootDir + usersFolder).forEach((file: any) => {
            var user = JSON.parse(fs.readFileSync(rootDir + usersFolder + file, 'utf8'));
            usersCache[file.split('.')[0]] = { identity: user.identity, credentials: user.credentials }
        });
    } catch (err) {
        console.log(err);
    }
}

export function SaveUserToFile(user: any) {
    try {
        const userId = user.identity.id.split(":")[0];
        const usersFolder = 'users/';
        fs.writeFile(rootDir + usersFolder + userId + '.json', JSON.stringify(user));
        console.log('User stored to ' +rootDir + userId + '.json');
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
}

export function LoadBotsFromFile(botsCache: BotCache) {
    try {
        const botsFolder = 'bots/';
        fs.readdirSync(rootDir + botsFolder).forEach((file: any) => {
            var bot = JSON.parse(fs.readFileSync(rootDir + botsFolder + file, 'utf8'));
            botsCache[file.split('.')[0]] = { 
                identity: bot.identity,
                token: bot.token
            }
        });
    } catch (err) {
        console.log(err);
    }
}

export function SaveBotToFile(bot: any) {
    try {
        const botId = bot.identity.id.split(":")[1];
        const botsFolder = 'bots/';
        fs.writeFile(rootDir + botsFolder + botId + '.json', JSON.stringify(bot));
        console.log('Bot stored to ' +rootDir + botId + '.json');
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
}

export function GetGoogleClientSecret(): any {
    var clientSecret = {};
    try {
        const googleFolder = 'google/';
        const file = 'client_secret.json';
        clientSecret = JSON.parse(fs.readFileSync(rootDir + googleFolder + file, 'utf8'));
    } catch (err) {
        console.log(err);
        return undefined;
    }
    return clientSecret;
}