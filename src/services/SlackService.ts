import { logger } from '@/utils/logger';
import { imageDownloader } from '@/utils/imageDownloader';
import { wordpressAPI } from '@/utils/wordpressAPI';
import {
  SlackWebhookPayload,
  ProcessingResult,
  UploadedImage,
  WordPressPostData
} from '@/types';
import { extractTitle } from '@/utils/contentUtils';
import {
  slackMessageRepository,
} from '@/repositories';
import EmojiConvertor from 'emoji-js';
import { ISlackMessage } from '@/models/slackMessage';

export class SlackService {
  /**
   * Process Slack message and create WordPress post
   */
  async processSlackMessage(slackMessage: SlackWebhookPayload): Promise<ProcessingResult> {
    const maxRetries: number = parseInt(process.env.MAX_RETRIES || '1', 10);
    const retryDelay: number = parseInt(process.env.RETRY_DELAY || '1000', 10);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let imageUrls: string[] = [];

      try {
        logger.info(`Processing Slack message (attempt ${attempt}/${maxRetries})`);

        const titleContent: string = extractTitle(slackMessage.text || '');
        logger.info(`Title content: ${titleContent}`);

        const messageText: string = this.extractMessageText(slackMessage);

        imageUrls = imageDownloader.extractImageUrls(slackMessage);

        const uploadedImages: UploadedImage[] = await this.processImages(imageUrls);

        const postResult = await this.createWordPressPost(messageText, uploadedImages, titleContent);

        return {
          success: true,
          postId: postResult.id,
          postUrl: postResult.link,
          imagesUploaded: uploadedImages.length,
          attempt: attempt,
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

    throw new Error('Max retries exceeded');
  }

  /**
   * Store new Slack message in database
   */
  async storeSlackMessage(event: any): Promise<void> {
    try {
      const existingMessage = await slackMessageRepository.findByClientMsgId(event.client_msg_id);
      if (!existingMessage) {
        const files = imageDownloader.extractImageUrls(event);

        await slackMessageRepository.create({
          clientMsgId: event.client_msg_id,
          text: event.text || '',
          channel: event.channel || '',
          timestamp: event.ts || '',
          userId: event.user || '',
          files: files
        });

        logger.info(`Stored new Slack message in DB: ${event.client_msg_id}`);
      } else {
        logger.info(`Slack message already exists in DB: ${event.client_msg_id}`);
      }
    } catch (dbError: any) {
      logger.error('Error storing Slack message in DB:', dbError);
      throw dbError;
    }
  }

  /**
   * Find original message for platform selection
   */
  async findOriginalMessage(messageId: string): Promise<ISlackMessage | null> {
    return await slackMessageRepository.findByClientMsgId(messageId);
  }

  async markAsPostedToWordPress(clientMsgId: string): Promise<ISlackMessage | null> {
    return slackMessageRepository.markAsPostedToWordPress(clientMsgId);
  }

  async markAsPostedToFacebook(clientMsgId: string): Promise<ISlackMessage | null> {
    return slackMessageRepository.markAsPostedToFacebook(clientMsgId);
  }

  /**
 /**
  * Convert Slack emoji shortcodes to Unicode emojis
  */
  private convertSlackShortcodesToUnicode(text: string): string {
    const emoji = new EmojiConvertor();
    emoji.replace_mode = 'unified';
    emoji.allow_native = true;
    emoji.include_title = false;
    emoji.include_text = false;

    let convertedText = emoji.replace_colons(text);

    const fallbackMap: { [key: string]: string } = {
      ':burger:': '🍔',
      ':pants:': '👖',
      ':skin-tone-1:': '🏻',
      ':skin-tone-2:': '🏼',
      ':skin-tone-3:': '🏽',
      ':skin-tone-4:': '🏾',
      ':skin-tone-5:': '🏿'
    };

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
   */
  private extractMessageText(slackMessage: SlackWebhookPayload): string {
    let text: string = slackMessage.text || '';

    logger.info('Original Slack text:', text);

    text = this.convertSlackShortcodesToUnicode(text);

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

      const downloadedImages = await imageDownloader.downloadMultipleImages(imageUrls);

      for (const image of downloadedImages) {
        try {
          const uploadedImage = await wordpressAPI.uploadMedia(image.buffer, image.filename);
          uploadedImages.push(uploadedImage);
          successCount++;
          logger.info(`Image uploaded to WordPress: ${uploadedImage.url}`);
        } catch (error: any) {
          failureCount++;
          logger.error(`Failed to upload image ${image.filename}:`, error.message);
        }
      }

      logger.info(`Image processing complete: ${successCount} successful, ${failureCount} failed`);

      if (failureCount === imageUrls.length && imageUrls.length > 0) {
        throw new Error(`Failed to upload all ${imageUrls.length} images to WordPress`);
      }

      return uploadedImages;

    } finally {
      if (tempFiles.length > 0) {
        await imageDownloader.cleanupTempFiles(tempFiles);
      }
    }
  }

  /**
   * Create WordPress post with content and images
   */
  private async createWordPressPost(
    messageText: string,
    uploadedImages: UploadedImage[],
    title: string
  ): Promise<{ id: number; link: string; title: string }> {
    if (!title) {
      title = messageText.length > 50
        ? messageText.substring(0, 50) + '...'
        : messageText || 'Slack Message';
    }

    let content: string = `<p>${messageText.replace(/\n/g, '<br>')}</p>`;

    if (uploadedImages.length > 0) {
      content += '\n<div class="slack-images">';
      for (const image of uploadedImages) {
        content += `\n<figure class="slack-image">
          <img src="${image.url}" alt="${image.alt_text || 'Slack image'}" />
        </figure>`;
      }
      content += '\n</div>';
    }

    const postData: WordPressPostData = {
      title: title,
      content: content,
      status: process.env.DEFAULT_POST_STATUS || 'draft'
    };

    logger.info('Post title with emojis:', title);
    logger.info('Post content with emojis:', content);

    if (uploadedImages.length > 0) {
      postData.featuredMedia = uploadedImages[0].id;
    }

    const result = await wordpressAPI.createPost(postData);
    return {
      id: result.id,
      link: result.link,
      title: result.title
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
