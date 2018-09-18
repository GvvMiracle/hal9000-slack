import * as restify from "restify"
import { SlackConnector } from "botbuilder-slack"
import { UniversalBot, IEvent, IIdentity } from "botbuilder"
// import { createBot, BotCache } from "./bot"
var env = require('node-env-file');
env(__dirname + '/../.env');

type BotCache = { [key: string]: { identity: IIdentity, token: string } }
const botsCache: BotCache = {}

const connectorSettings = {
  botLookup: (teamId: string) => {
    const botEntry = botsCache[teamId]

    if (botEntry) {
      return Promise.resolve([botEntry.token, botEntry.identity.id] as [string, string])
    } else {
      return Promise.reject(new Error('Bot not found'))
    }
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
console.log(connectorSettings)


const connector = new SlackConnector(connectorSettings)

const bot = new UniversalBot(connector)
const app = restify.createServer()

app.use(restify.plugins.queryParser())
app.use(restify.plugins.bodyParser())

bot.on('installationUpdate', (event: IEvent) => {
  console.info(`New bot installed by ${event.sourceEvent.SlackMessage.user_id}`)

  botsCache[event.sourceEvent.SlackMessage.team_id] = {
    identity: event.address.bot,
    token: event.sourceEvent.ApiToken
  }
})

bot.dialog('/', (session) => {
  session.endDialog('pong')
})

bot.dialog('Greeting', (session) => {
  session.endConversation('Nice to meet you');
})

bot.on("slackCommand", (event) => {
  const commandName = event.sourceEvent.SlackMessage.command
  const dialogName = commandName.split("/")[1]

  bot.beginDialog(event.address, `${dialogName}`)
})

app.listen(3000, () => {
  console.log("Bot is listening...")
})

app.post('/slack/events', connector.listenEvents() as restify.RequestHandlerType)
app.post('/slack/interactive', connector.listenInteractiveMessages() as restify.RequestHandlerType)
app.post('/slack/command', connector.listenCommands() as restify.RequestHandlerType)
app.get('/oauth', connector.listenOAuth() as restify.RequestHandlerType)


app.get('/oauth.error', (error) => {
    console.log('oauth.error');
});

app.get('/oauth.success', (payload) => {
  console.log('oauth.success');
  console.log(payload);
});

// createBot(connector, botsCache)
