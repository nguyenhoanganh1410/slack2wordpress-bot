import { SlackMessage, ISlackMessage } from '@/models/slackMessage';
import { BaseRepository } from './BaseRepository';

export class SlackMessageRepository extends BaseRepository<ISlackMessage> {
  constructor() {
    super(SlackMessage);
  }

  async findByClientMsgId(clientMsgId: string): Promise<ISlackMessage | null> {
    return this.findOne({ clientMsgId });
  }

  async findByUserId(userId: string): Promise<ISlackMessage[]> {
    return this.find({ userId }, { createdAt: -1 });
  }

  async findByChannel(channel: string): Promise<ISlackMessage[]> {
    return this.find({ channel }, { createdAt: -1 });
  }

  async findRecentByUserAndChannel(userId: string, channelId: string): Promise<ISlackMessage | null> {
    return this.model.findOne({ userId, channel: channelId }).sort({ createdAt: -1 });
  }

  async markAsPostedToWordPress(clientMsgId: string): Promise<ISlackMessage | null> {
    return this.updateOne(
      { clientMsgId },
      { isPostedToWordPress: true }
    );
  }

  async markAsPostedToFacebook(clientMsgId: string): Promise<ISlackMessage | null> {
    return this.updateOne(
      { clientMsgId },
      { isPostedToFacebook: true }
    );
  }

  async findUnpostedToWordPress(): Promise<ISlackMessage[]> {
    return this.find({ isPostedToWordPress: false }, { createdAt: -1 });
  }

  async findUnpostedToFacebook(): Promise<ISlackMessage[]> {
    return this.find({ isPostedToFacebook: false }, { createdAt: -1 });
  }
}
