import { Request, Response } from 'express';
import axios from 'axios';
import { logger } from '@/utils/logger';
import { wordpressAPI } from '@/utils/wordpressAPI';
import { imageDownloader } from '@/utils/imageDownloader';
import EmojiConvertor from 'emoji-js';
import {
  SlackWebhookPayload,
  SlackEventPayload,
  ProcessingResult,
  UploadedImage,
  WordPressPostData,
  SlackResponsePayload,
  SlackErrorResponsePayload,
  SlackErrorField,
  WordPressErrorType
} from '@/types';
import { extractTitle } from '@/utils/contentUtils';

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
      this.processSlackMessage(slackData)
        .then(result => {
          logger.info('Slack message processed successfully:', result);
        })
        .catch(async (error) => {
          logger.error('Error processing Slack message:', error);
          
          // Send final error notification if all retries failed
          await this.sendSlackErrorResponse(
            error,
            parseInt(process.env.MAX_RETRIES || '3', 10),
            parseInt(process.env.MAX_RETRIES || '3', 10)
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

        // Process the message asynchronously
        this.processSlackMessage(event)
          .then(result => {
            logger.info('Slack event processed successfully:', result);
          })
          .catch(async (error) => {
            logger.error('Error processing Slack event:', error);
            
            // Send final error notification if all retries failed
            await this.sendSlackErrorResponse(
              error,
              parseInt(process.env.MAX_RETRIES || '3', 10),
              parseInt(process.env.MAX_RETRIES || '3', 10)
            );
          });
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
   * Process Slack message and create WordPress post
   * @param slackMessage - Slack message object
   * @returns Processing result
   */
  async processSlackMessage(slackMessage: SlackWebhookPayload): Promise<ProcessingResult> {
    const maxRetries: number = parseInt(process.env.MAX_RETRIES || '3', 10);
    const retryDelay: number = parseInt(process.env.RETRY_DELAY || '1000', 10);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let imageUrls: string[] = [];
      
      try {
        logger.info(`Processing Slack message (attempt ${attempt}/${maxRetries})`);

        const titleContent: string = extractTitle(slackMessage.text || '');
        logger.info(`Title content: ${titleContent}`);
        // Extract message text
        const messageText: string = this.extractMessageText(slackMessage);

        // Extract image URLs
        imageUrls = imageDownloader.extractImageUrls(slackMessage);

        // Download and upload images
        const uploadedImages: UploadedImage[] = await this.processImages(imageUrls);
 
        // Create WordPress post
        const postResult = await this.createWordPressPost(messageText, uploadedImages, titleContent);

        // Send response back to Slack
        const slackResponseSent = await this.sendSlackResponse(
          postResult.link,
          postResult.title || 'Bài viết mới'
        );

        return {
          success: true,
          postId: postResult.id,
          postUrl: postResult.link,
          imagesUploaded: uploadedImages.length,
          attempt: attempt,
          slackResponseSent: slackResponseSent
        };

      } catch (error: any) {
        logger.error(`Attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retrying
        await this.sleep(retryDelay * attempt);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Max retries exceeded');
  }

  /**
   * Convert Slack emoji shortcodes to Unicode emojis using emoji-js library
   * @param text - Text containing Slack emoji shortcodes
   * @returns Text with Unicode emojis
   */
  private convertSlackShortcodesToUnicode(text: string): string {
    // Initialize emoji converter
    const emoji = new EmojiConvertor();
    emoji.replace_mode = 'unified'; // Use unified Unicode instead of images
    emoji.allow_native = true;
    emoji.include_title = false;
    emoji.include_text = false;
    
    // Use emoji-js library to convert all shortcodes to Unicode
    let convertedText = emoji.replace_colons(text);
    
    // Add fallback for unsupported emojis
    const fallbackMap: { [key: string]: string } = {
      ':burger:': '🍔',
      ':pants:': '👖',
      ':skin-tone-1:': '🏻',
      ':skin-tone-2:': '🏼',
      ':skin-tone-3:': '🏽',
      ':skin-tone-4:': '🏾',
      ':skin-tone-5:': '🏿'
    };
    
    // Apply fallback conversions
    for (const [shortcode, unicode] of Object.entries(fallbackMap)) {
      convertedText = convertedText.replace(new RegExp(shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), unicode);
    }
    
    logger.info('Converted text from shortcodes to Unicode:', {
      original: text,
      converted: convertedText
    });

    return convertedText;
  }

  /**
   * Extract message text from Slack message
   * @param slackMessage - Slack message object
   * @returns Extracted text
   */
  private extractMessageText(slackMessage: SlackWebhookPayload): string {
    let text: string = slackMessage.text || '';

    // Log original text for debugging emoji preservation
    logger.info('Original Slack text:', text);

    // Convert Slack shortcodes to Unicode emojis
    text = this.convertSlackShortcodesToUnicode(text);

    // Add attachment text
    if (slackMessage.attachments && Array.isArray(slackMessage.attachments)) {
      for (const attachment of slackMessage.attachments) {
        if (attachment.text) {
          text += '\n\n' + this.convertSlackShortcodesToUnicode(attachment.text);
        }
        if (attachment.fallback) {
          text += '\n\n' + this.convertSlackShortcodesToUnicode(attachment.fallback);
        }
      }
    }

    // Add file descriptions
    if (slackMessage.files && Array.isArray(slackMessage.files)) {
      for (const file of slackMessage.files) {
        if (file.name && !file.mimetype?.startsWith('image/')) {
          text += `\n\nFile: ${file.name}`;
        }
      }
    }

    const finalText = text.trim();
    logger.info('Final extracted text:', finalText);
    return finalText;
  }

  /**
   * Process images: download from Slack and upload to WordPress
   * @param imageUrls - Array of image URLs
   * @returns Array of uploaded image info
   */
  private async processImages(imageUrls: string[]): Promise<UploadedImage[]> {
    const uploadedImages: UploadedImage[] = [];
    const tempFiles: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      if (imageUrls.length === 0) {
        return uploadedImages;
      }

      logger.info(`Processing ${imageUrls.length} images`);

      // Download images
      const downloadedImages = await imageDownloader.downloadMultipleImages(imageUrls);

      // Upload to WordPress
      for (const image of downloadedImages) {
        try {
          const uploadedImage = await wordpressAPI.uploadMedia(image.buffer, image.filename);
          uploadedImages.push(uploadedImage);
          successCount++;
          logger.info(`Image uploaded to WordPress: ${uploadedImage.url}`);
        } catch (error: any) {
          failureCount++;
          logger.error(`Failed to upload image ${image.filename}:`, error.message);
          // Continue with other images
        }
      }

      // Log summary
      logger.info(`Image processing complete: ${successCount} successful, ${failureCount} failed`);

      // If all uploads failed, throw an error to trigger Slack notification
      if (failureCount === imageUrls.length && imageUrls.length > 0) {
        throw new Error(`Failed to upload all ${imageUrls.length} images to WordPress`);
      }

      return uploadedImages;

    } finally {
      // Clean up temporary files
      if (tempFiles.length > 0) {
        await imageDownloader.cleanupTempFiles(tempFiles);
      }
    }
  }

  /**
   * Create WordPress post with content and images
   * @param messageText - Message text
   * @param uploadedImages - Array of uploaded image info
   * @param slackMessage - Original Slack message
   * @returns Created post info
   */
  private async createWordPressPost(
    messageText: string,
    uploadedImages: UploadedImage[],
    title: string
  ): Promise<{ id: number; link: string; title: string }> {
    // Fallback to original text if title is empty after removing emojis
    if (!title) {
      title = messageText.length > 50
        ? messageText.substring(0, 50) + '...'
        : messageText || 'Slack Message';
    }

    // Build content with embedded images
    let content: string = `<p>${messageText.replace(/\n/g, '<br>')}</p>`;

    // Add images to content
    if (uploadedImages.length > 0) {
      content += '\n<div class="slack-images">';
      for (const image of uploadedImages) {
        content += `\n<figure class="slack-image">
          <img src="${image.url}" alt="${image.alt_text || 'Slack image'}" />
        </figure>`;
      }
      content += '\n</div>';
    }
    
    // Create post data
    const postData: WordPressPostData = {
      title: title,
      content: content,
      status: process.env.DEFAULT_POST_STATUS || 'draft'
    };

    // Log post data for debugging emoji preservation
    logger.info('Post title with emojis:', title);
    logger.info('Post content with emojis:', content);

    // Set featured image (first uploaded image)
    if (uploadedImages.length > 0) {
      postData.featuredMedia = uploadedImages[0].id;
    }

    // Create the post
    const result = await wordpressAPI.createPost(postData);
    return {
      id: result.id,
      link: result.link,
      title: result.title
    };
  }

  /**
   * Send response message back to Slack with WordPress post URL
   * @param postUrl - URL of the created WordPress post
   * @param postTitle - Title of the created WordPress post
   * @returns Promise<boolean> - True if response sent successfully, false otherwise
   */
  private async sendSlackResponse(
    postUrl: string,
    postTitle: string,
  ): Promise<boolean> {
    try {
      const webhookUrl = process.env.SLACK_RESPONSE_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
      
      if (!webhookUrl) {
        logger.warn('No Slack webhook URL configured for response');
        return false;
      }

      const responsePayload: SlackResponsePayload = {
        text: `✅ Bài viết đã được đăng thành công lên WordPress!`,
        attachments: [
          {
            title: postTitle,
            title_link: postUrl,
            text: `Xem bài viết đầy đủ tại link trên`,
            color: 'good',
            fallback: `Bài viết "${postTitle}" đã được đăng thành công: ${postUrl}`
          }
        ]
      };

      await axios.post(webhookUrl, responsePayload);
      logger.info(`Slack response sent successfully for post: ${postUrl}`);
      return true;

    } catch (error: any) {
      logger.error('Failed to send Slack response:', error.response?.data || error.message);
      return false;
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
   * Sleep utility for retry delays
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after ms milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const slackController = new SlackController();
export default slackController;
