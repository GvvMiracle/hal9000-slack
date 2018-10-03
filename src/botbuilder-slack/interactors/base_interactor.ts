import { IEvent } from "botbuilder"
import { WebClient } from "@slack/client"
import { ISlackEnvelope, ISlackOAuthEnvelope } from "../interfaces"
import { ISlackConnectorSettings } from "../slack_connector"
import * as utils from "../utils"
import { SlackIdentity, buildIdentity } from "../address";
import { SaveUserToFile } from "../../botutils/fs_reader";

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

  protected async buildUser(botbuilderBotId: string, userId: string): Promise<SlackIdentity> {
    // if (!this.settings.dataCache) {
    //   return null
    // }

    const botIdentity  = utils.decomposeUserId(botbuilderBotId)
    const userIdentity = utils.buildUserIdentity(userId, botIdentity.teamId)

    const [cachedUser] = await this.settings.findUsers(userId)

    if (cachedUser) {
      userIdentity.name = cachedUser.name
      userIdentity.fullname = cachedUser.fullname;
    }
    else { 
      // Get user info and store it in cache using the bot access token
      let bot = await this.settings.botLookup(botIdentity.teamId); // bot[0] token, bot[1] identity
      const user = await (new WebClient(bot[0]).users.info(userId));
      var userToSave = buildIdentity(userId, botIdentity.teamId, user.user.profile.real_name, user.user.name, user.user.profile.email);
      var userIden = await this.settings.addUser(userToSave);     
      SaveUserToFile(userIden); 
      return userToSave;
    }

    return userIdentity
  }

}
