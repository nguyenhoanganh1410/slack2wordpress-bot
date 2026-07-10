export { SlackService } from './SlackService';

// Export singleton instance for dependency injection
import { SlackService } from './SlackService';

export const slackService = new SlackService();
