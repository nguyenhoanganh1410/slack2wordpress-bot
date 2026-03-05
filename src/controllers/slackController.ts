import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { wordpressAPI } from '@/utils/wordpressAPI';
import { imageDownloader } from '@/utils/imageDownloader';
import EmojiConvertor from 'emoji-js';
import {
  SlackWebhookPayload,
  SlackEventPayload,
  ProcessingResult,
  UploadedImage,
  WordPressPostData
} from '@/types';

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
        .catch(error => {
          logger.error('Error processing Slack message:', error);
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
          .catch(error => {
            logger.error('Error processing Slack event:', error);
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
      try {
        logger.info(`Processing Slack message (attempt ${attempt}/${maxRetries})`);

        // Extract message text
        const messageText: string = this.extractMessageText(slackMessage);

        // Extract image URLs
        const imageUrls: string[] = imageDownloader.extractImageUrls(slackMessage);

        // Download and upload images
        const uploadedImages: UploadedImage[] = await this.processImages(imageUrls);

        // Create WordPress post
        const postResult = await this.createWordPressPost(messageText, uploadedImages);

        return {
          success: true,
          postId: postResult.id,
          postUrl: postResult.link,
          imagesUploaded: uploadedImages.length,
          attempt: attempt
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
          logger.info(`Image uploaded to WordPress: ${uploadedImage.url}`);
        } catch (error: any) {
          logger.error(`Failed to upload image ${image.filename}:`, error.message);
          // Continue with other images
        }
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
  ): Promise<{ id: number; link: string }> {
    // Generate title (first 50 characters of text)
    const title: string = messageText.length > 50
      ? messageText.substring(0, 50) + '...'
      : messageText || 'Slack Message';

    // Build content with embedded images
    let content: string = `<p>${messageText.replace(/\n/g, '<br>')}</p>`;

    // Add images to content
    if (uploadedImages.length > 0) {
      content += '\n<div class="slack-images">';
      for (const image of uploadedImages) {
        content += `\n<figure class="slack-image">
          <img src="${image.url}" alt="${image.alt_text || 'Slack image'}" />
          ${image.title ? `<figcaption>${image.title}</figcaption>` : ''}
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
      link: result.link
    };
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
