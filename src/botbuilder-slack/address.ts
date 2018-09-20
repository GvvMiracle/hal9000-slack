import { IAddress, IIdentity } from "botbuilder"
import { ISlackAddress } from "./slack_connector"
import * as utils from "./utils"

export interface IIsAddress {
  toAddress(): IAddress
}

export class Address {
  private data = {} as ISlackAddress

  private teamId: string
  private channelId?: string
  private threadTs?: string

  constructor(teamId: string) {
    this.teamId = teamId

    this.data.channelId = "slack"
  }

  public id(id: string): Address {
    this.data.id = id

    return this
  }

  public thread(ts: string): Address {
    this.threadTs = ts

    return this
  }

  public channel(channel: string): Address {
    this.channelId = channel

    return this
  }

  public user(user: string, fullname?: string, name?: string, email?: string): Address {
    this.data.user = buildIdentity(user, this.teamId, fullname, name, email)

    return this
  }

  public bot(bot: string, name?: string): Address {
    this.data.bot = buildIdentity(bot, this.teamId, name)

    return this
  }

  public toAddress(): IAddress {
    if (!this.data.bot || !this.data.user) {
      throw new Error("Invalid address")
    }

    if (this.channelId) {
      const messageId = this.threadTs || this.data.id
      const { botId, teamId } = utils.decomposeBotId(this.data.bot.id)

      this.data.conversation = utils.buildConversationIdentity(botId, teamId, this.channelId, messageId)
    }

    return this.data
  }
}

export function buildIdentity(userId: string, teamId: string, fullname?: string, name?: string, email?: string): SlackIdentity {
  const identity: SlackIdentity = {
    id: `${userId}:${teamId}`,
  }

  if(fullname) {
    identity.fullname = fullname;
  }

  if (name) {
    identity.name = name
  }

  if (email) {
    identity.email = email
  }

  return identity
}

export interface SlackIdentity extends IIdentity {
  email? : string;
  fullname? : string;
}
