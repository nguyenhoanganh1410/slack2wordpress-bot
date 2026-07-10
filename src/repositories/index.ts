export { BaseRepository } from './BaseRepository';
export { SlackMessageRepository } from './SlackMessageRepository';

// Export singleton instances for dependency injection
import { SlackMessageRepository } from './SlackMessageRepository';

export const slackMessageRepository = new SlackMessageRepository();
