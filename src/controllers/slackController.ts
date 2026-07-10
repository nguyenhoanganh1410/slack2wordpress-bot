import { Request, Response } from 'express';
import axios from 'axios';
import { logger } from '@/utils/logger';
import {
  SlackWebhookPayload,
  SlackEventPayload,
  SlackErrorResponsePayload,
  SlackErrorField,
  WordPressErrorType
} from '@/types';
import { SlackMessageBuilder } from '@/utils/slackMessageBuilder';
import { slackService } from '@/services';

class SlackController {
  /**
   * Handle Slack Incoming Webhook
   * @param req - Express request object
   * @param res - Express response object
   */
  async handleSlackWebhook(req: Request, res: Response): Promise<void> {
    try {
      const slackData: SlackWebhookPayload = req.body;

      logger.info('Received Slack webhook:', JSON.stringify(slackData, null, 2));

      // Validate webhook data
      if (!slackData.text && !slackData.attachments && !slackData.files) {
        res.status(400).json({
          success: false,
          error: 'No content found in Slack message'
        });
        return;
      }

      // Process the message asynchronously
      slackService.processSlackMessage(slackData)
        .then(result => {
          logger.info('Slack message processed successfully:', result);
        })
        .catch(async (error) => {
          logger.error('Error processing Slack message:', error);

          // Send final error notification if all retries failed
          await this.sendSlackErrorResponse(
            error,
            parseInt(process.env.MAX_RETRIES || '1', 10),
            parseInt(process.env.MAX_RETRIES || '1', 10)
          );
        });

      // Respond immediately to Slack (webhook timeout is 3 seconds)
      res.status(200).json({
        success: true,
        message: 'Message received and will be processed'
      });

    } catch (error: any) {
      logger.error('Error in Slack webhook handler:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Handle Slack Interactivity (button clicks, etc.)
   * @param req - Express request object
   * @param res - Express response object
   */
  async handleSlackInteractivity(req: Request, res: Response): Promise<void> {
    try {
      const payload = JSON.parse(req.body.payload);
      logger.info('Received Slack interactivity payload:', payload.actions);

      // Handle platform selection
      if (payload.type === 'block_actions' && payload.actions) {
        const action = payload.actions[0];
        const actionId = action.action_id;
        const value = action.value;

        if (actionId.startsWith('select_platform_')) {
          await this.handlePlatformSelection(value);
        }
      }

      res.status(200).send('OK');
    } catch (error: any) {
      logger.error('Error in Slack interactivity handler:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Handle platform selection from interactive message
   * @param value - Action value (format: "platform:userId:channelId")
   */
  private async handlePlatformSelection(value: string): Promise<void> {
    try {
      const [platform, messageId] = value.split('_');

      logger.info(`Platform selected: ${platform} by for message ID: ${messageId}`);

      // Find the original message from database
      const originalMessage = await slackService.findOriginalMessage(messageId);

      if (!originalMessage) {
        logger.error('Could not find original message for platform selection');
        const errorMessage = SlackMessageBuilder.buildErrorMessage(platform as any, 'Không tìm thấy tin nhắn gốc. Vui lòng thử lại.');
        await this.sendInteractiveMessage({
          ...errorMessage
        });
        return;
      }

      // Send confirmation message
      const confirmationMessage = SlackMessageBuilder.buildSelectionConfirmation(platform as any);
      await this.sendInteractiveMessage({
        ...confirmationMessage
      });

      const slackWebhookPayload: SlackWebhookPayload = {
        text: originalMessage.text,
        user: originalMessage.userId,
        channel: originalMessage.channel,
        timestamp: originalMessage.timestamp,
        files: originalMessage.files.map(fileUrl => ({ url_private: fileUrl, id: '', name: '' })),
      };

      if (platform === 'all') {
        if (!originalMessage?.isPostedToWordPress) {
          const postResult = await slackService.processSlackMessage(slackWebhookPayload);
          await slackService.markAsPostedToWordPress(messageId);
          const message = SlackMessageBuilder.buildSuccessMessage(platform as any, postResult.postUrl || '', `Bài viết đã được đăng lên Web thành công! Bạn có thể xem tại đây: ${postResult.postUrl}`);
          await this.sendInteractiveMessage(message);
        }
        return;
      }

      if (platform === 'wordpress' && !originalMessage?.isPostedToWordPress) {
        // Process the original message
        const postResult = await slackService.processSlackMessage(slackWebhookPayload);
        await slackService.markAsPostedToWordPress(messageId);
        const message = SlackMessageBuilder.buildSuccessMessage(platform as any, postResult.postUrl || '', `Bài viết đã được đăng lên Web thành công! Bạn có thể xem tại đây: ${postResult.postUrl}`);
        await this.sendInteractiveMessage(message);
        return;
      }

      // For Facebook or other platforms, you can implement additional logic here
      if (platform === 'facebook' && !originalMessage?.isPostedToFacebook) {
        return;
      }
    } catch (error: any) {
      logger.error('Error handling platform selection:', error);
    }
  }

  /**
   * Handle Slack Events API
   * @param req - Express request object
   * @param res - Express response object
   */
  async handleSlackEvent(req: Request, res: Response): Promise<void> {
    try {
      const { type, challenge, event }: SlackEventPayload = req.body;
      // Handle URL verification for Events API
      if (type === 'url_verification') {
        res.status(200).send(challenge);
        return;
      }

      // Handle message events
      if (type === 'event_callback' && event?.type === 'message') {
        // Skip bot messages
        if (event.bot_id || event.subtype === 'bot_message') {
          res.status(200).send('OK');
          return;
        }

        logger.info('Received Slack event:', event);

        // Store message data in MongoDB on first call
        if (event.client_msg_id) {
          try {
            await slackService.storeSlackMessage(event);
            logger.info(`Stored new Slack message in DB: ${event.client_msg_id}`);

            // Send platform selection message for new messages
            if (event.client_msg_id) {
              const platformSelectionMessage = SlackMessageBuilder.buildPlatformSelection(event.client_msg_id);
              await this.sendInteractiveMessage(platformSelectionMessage);
              logger.info(`Sent platform selection for new message: ${event.client_msg_id}`);
            }
          } catch (dbError: any) {
            logger.error('Error storing Slack message in DB:', dbError);
            // Continue processing even if DB save fails
          }
        } else {
          logger.warn('Received Slack message event without client_msg_id, skipping DB storage and platform selection');
        }
      }

      res.status(200).send('OK');
    } catch (error: any) {
      logger.error('Error in Slack event handler:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Send error notification back to Slack when WordPress posting fails
   * @param error - The error that occurred
   * @param attempt - Current attempt number
   * @param maxRetries - Maximum number of retries
   * @param partialSuccess - Information about partial success (e.g., some images uploaded)
   * @returns Promise<boolean> - True if error response sent successfully, false otherwise
   */
  private async sendSlackErrorResponse(
    error: any,
    attempt: number,
    maxRetries: number,
    partialSuccess?: { imagesUploaded: number; totalImages: number }
  ): Promise<boolean> {
    try {
      const webhookUrl = process.env.SLACK_RESPONSE_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;

      if (!webhookUrl) {
        logger.warn('No Slack webhook URL configured for error response');
        return false;
      }

      // Determine error type and create appropriate message
      let errorIcon = '❌';
      let errorColor = 'danger';
      let errorTitle = 'Lỗi đăng bài WordPress';
      let errorMessage = error.message || 'Lỗi không xác định';
      let suggestion = '';

      // Handle WordPress errors specifically
      if (error.type) {
        switch (error.type) {
          case WordPressErrorType.AUTHENTICATION:
            errorIcon = '🔐';
            errorTitle = 'Lỗi xác thực WordPress';
            suggestion = 'Kiểm tra lại tên đăng nhập và mật khẩu WordPress trong cấu hình';
            break;

          case WordPressErrorType.NETWORK:
            errorIcon = '🌐';
            errorTitle = 'Lỗi kết nối WordPress';
            suggestion = 'Kiểm tra kết nối mạng và URL của trang WordPress';
            errorColor = 'warning';
            break;

          case WordPressErrorType.VALIDATION:
            errorIcon = '⚠️';
            errorTitle = 'Lỗi dữ liệu';
            suggestion = 'Kiểm tra lại nội dung bài viết, có thể chứa ký tự không hợp lệ';
            errorColor = 'warning';
            break;

          case WordPressErrorType.MEDIA_UPLOAD:
            errorIcon = '🖼️';
            errorTitle = 'Lỗi tải ảnh lên';
            suggestion = 'Kiểm tra kích thước và định dạng file ảnh';
            errorColor = 'warning';
            break;

          case WordPressErrorType.SERVER_ERROR:
            errorIcon = '🔥';
            errorTitle = 'Lỗi máy chủ WordPress';
            suggestion = 'Máy chủ WordPress đang gặp sự cố, vui lòng thử lại sau';
            break;
        }
      }

      // Build fields for the error message
      const fields: SlackErrorField[] = [
        {
          title: 'Lần thử',
          value: `${attempt}/${maxRetries}`,
          short: true
        },
        {
          title: 'Thời gian',
          value: new Date().toLocaleString('vi-VN'),
          short: true
        }
      ];

      // Add partial success information if available
      if (partialSuccess && partialSuccess.imagesUploaded > 0) {
        fields.push({
          title: 'Ảnh đã tải lên',
          value: `${partialSuccess.imagesUploaded}/${partialSuccess.totalImages}`,
          short: true
        });
      }

      // Add error details for debugging (only in development or if enabled)
      if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DETAILED_ERRORS === 'true') {
        fields.push({
          title: 'Chi tiết lỗi',
          value: `\`${error.endpoint || 'N/A'}\`\n\`${error.statusCode || 'N/A'}\``,
          short: false
        });
      }

      const errorResponsePayload: SlackErrorResponsePayload = {
        text: `${errorIcon} ${errorTitle}: ${errorMessage}`,
        attachments: [
          {
            title: errorTitle,
            text: `${errorMessage}${suggestion ? `\n\n💡 *Gợi ý:* ${suggestion}` : ''}`,
            color: errorColor,
            fallback: `${errorTitle}: ${errorMessage}`,
            fields: fields
          }
        ]
      };

      // Add mention if configured for critical errors
      if (process.env.SLACK_ERROR_MENTION_USER && error.type !== WordPressErrorType.VALIDATION) {
        errorResponsePayload.text = `<@${process.env.SLACK_ERROR_MENTION_USER}> ${errorResponsePayload.text}`;
      }

      await axios.post(webhookUrl, errorResponsePayload);
      logger.info(`Slack error response sent successfully for attempt: ${attempt}/${maxRetries}`);
      return true;

    } catch (error: any) {
      logger.error('Failed to send Slack error response:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Send interactive message to Slack using Web API
   * @param channel - Channel ID to send message to
   * @param message - Message payload from SlackMessageBuilder
   * @returns Promise<boolean> - True if message sent successfully, false otherwise
   */
  private async sendInteractiveMessage(message: any): Promise<boolean> {
    try {
      const webhookUrl = process.env.SLACK_RESPONSE_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;

      if (!webhookUrl) {
        logger.warn('No Slack webhook URL configured for response');
        return false;
      }

      await axios.post(webhookUrl, message);
      logger.info(`Interactive message sent successfully to channel: ${message?.channel}`);
      return true;
    } catch (error: any) {
      logger.error('Error sending interactive message:', error);
      return false;
    }
  }
}

// Export singleton instance
export const slackController = new SlackController();
export default slackController;
