import { Request, Response } from 'express';
import { SlackWebhookPayload, ProcessingResult } from '../types';
declare class SlackController {
    handleSlackWebhook(req: Request, res: Response): Promise<void>;
    handleSlackEvent(req: Request, res: Response): Promise<void>;
    processSlackMessage(slackMessage: SlackWebhookPayload): Promise<ProcessingResult>;
    private convertSlackShortcodesToUnicode;
    private extractMessageText;
    private processImages;
    private createWordPressPost;
    private sendSlackResponse;
    private sleep;
}
export declare const slackController: SlackController;
export default slackController;
//# sourceMappingURL=slackController.d.ts.map