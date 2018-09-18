import { IEvent, IIdentity } from "botbuilder"
import { ISlackEnvelope, ISlackOAuthEnvelope } from "../interfaces"
import { ISlackConnectorSettings } from "../slack_connector"
import * as utils from "../utils"

export interface IInteractorResult {
  events: IEvent[]
  response?: any
}

export abstract class BaseInteractor<Envelope extends ISlackEnvelope | ISlackOAuthEnvelope> {
  public readonly settings: ISlackConnectorSettings
  public readonly envelope: Envelope

  constructor(settings: ISlackConnectorSettings, envelope: Envelope) {
    this.settings = settings
    this.envelope = envelope
  }

  public abstract async call(): Promise<IInteractorResult>

  protected async buildUser(botbuilderBotId: string, userId: string): Promise<IIdentity> {
    // if (!this.settings.dataCache) {
    //   return null
    // }

    const botIdentity  = utils.decomposeUserId(botbuilderBotId)
    const userIdentity = utils.buildUserIdentity(userId, botIdentity.teamId)

    const [cachedUser] = await this.settings.findUsers(userId)

    if (cachedUser) {
      userIdentity.name = cachedUser.name
    }

    return userIdentity
  }

}
