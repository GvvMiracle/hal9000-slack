import * as express from "express"
import * as bodyParser from "body-parser"
import { SlackConnector } from "./botbuilder-slack"
import { SlackBot, BotCache, UserCache } from "./bot"
var env = require('node-env-file');
env(__dirname + '/../.env');
const port = process.env.PORT || 3000
const botsCache: BotCache = {}
const usersCache: UserCache = {}
const luisURI = process.env.LUIS_URI;
const app = express()
const connectorSettings = {
  botLookup: (teamId: string) => {
    const botEntry = botsCache[teamId]
    
    if (botEntry) {
      return Promise.resolve([botEntry.token, botEntry.identity.id] as [string, string])
    } else {
      return Promise.reject(new Error('Bot not found'))
    }
  },
  
  findUsers: (userId: string) => {
    const user = usersCache[userId]
    
    if (user) {
      return Promise.resolve([user.identity] as [any])
    } else {
      return Promise.resolve([undefined] as any)
    }
  },

  addUser: (user: any) => {
    const [userId, teamId] = user.id.split(":");
    usersCache[userId] = {
      identity: user
    }
    return Promise.resolve([usersCache[userId]] as [any])
  },
  botName: process.env.SLACK_BOT_NAME,
  verificationToken: process.env.SLACK_VERIFICATION_TOKEN,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  redirectUrl: process.env.SLACK_OAUTH_REDIRECT_URL,
  onOAuthSuccessRedirectUrl: process.env.SLACK_OAUTH_ON_SUCCESS_REDIRECT_URL,
  onOAuthErrorRedirectUrl: process.env.SLACK_OAUTH_ON_ERROR_REDIRECT_URL,
  onOAuthAccessDeniedRedirectUrl: process.env.SLACK_OAUTH_ON_ACCESS_DENIED_REDIRECT_URL
}
const connector = new SlackConnector(connectorSettings)

app.use(bodyParser.json())
app.use(bodyParser.urlencoded())

app.use('/oauth2callback', (req: express.Request, res: express.Response) => {
  var code = req.query.code;
  bot.storeToken(code);
  res.status(200).send();
})

app.listen(port, () => {
  console.log(`Bot is listening on port ${port}`)
})

app.post('/slack/events',  connector.listenEvents())
app.post('/slack/actions', connector.listenInteractiveMessages())
app.post('/slack/command', connector.listenCommands())
app.get('/oauth', connector.listenOAuth())

app.get('/oauth.error', (error) => {
  console.trace('oauth.error');
});

app.get('/oauth.success', (payload) => {
console.log('oauth.success');
});

var bot = new SlackBot(connector, botsCache, usersCache, luisURI);
