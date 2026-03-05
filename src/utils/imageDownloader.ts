import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { 
  SlackMessage, 
  DownloadedImage 
} from '@/types';

class ImageDownloader {
  private slackToken: string | undefined;
  private tempDir: string;

  constructor() {
    this.slackToken = process.env.SLACK_BOT_TOKEN;
    this.tempDir = path.join(__dirname, '../../temp');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Download image from Slack URL
   * @param imageUrl - Slack image URL
   * @param filename - Optional filename
   * @returns Image buffer and filename
   */
  async downloadImage(imageUrl: string, filename?: string): Promise<DownloadedImage> {
    try {
      logger.info(`Downloading image from: ${imageUrl}`);
      
      // For Slack private URLs, we need to add authorization header
      const headers: any = {};
      if (imageUrl.includes('files.slack.com') && this.slackToken) {
        headers['Authorization'] = `Bearer ${this.slackToken}`;
      }

      const response: AxiosResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers,
        timeout: 30000 // 30 seconds timeout
      });

      const buffer: Buffer = Buffer.from(response.data);
      
      // Generate filename if not provided
      if (!filename) {
        const urlParts = imageUrl.split('/');
        filename = urlParts[urlParts.length - 1] || `image_${Date.now()}`;
        
        // Add extension if missing
        const contentType = response.headers['content-type'];
        if (contentType && contentType.startsWith('image/') && !filename.includes('.')) {
          const extension = contentType.split('/')[1];
          filename += `.${extension}`;
        }
      }

      logger.info(`Image downloaded successfully. Size: ${buffer.length} bytes`);
      return { buffer, filename };
    } catch (error: any) {
      logger.error(`Error downloading image from ${imageUrl}:`, error.message);
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  /**
   * Download multiple images from Slack URLs
   * @param imageUrls - Array of image URLs
   * @returns Array of downloaded images
   */
  async downloadMultipleImages(imageUrls: string[]): Promise<DownloadedImage[]> {
    const results: DownloadedImage[] = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const image = await this.downloadImage(imageUrls[i], `image_${i + 1}.jpg`);
        results.push(image);
      } catch (error: any) {
        logger.error(`Failed to download image ${i + 1}:`, error.message);
        // Continue with other images even if one fails
      }
    }
    
    return results;
  }

  /**
   * Save image buffer to temporary file
   * @param buffer - Image buffer
   * @param filename - Filename
   * @returns File path
   */
  async saveToTemp(buffer: Buffer, filename: string): Promise<string> {
    try {
      const filePath = path.join(this.tempDir, filename);
      await fs.promises.writeFile(filePath, buffer);
      logger.info(`Image saved to temp file: ${filePath}`);
      return filePath;
    } catch (error: any) {
      logger.error(`Error saving image to temp file:`, error.message);
      throw new Error(`Failed to save image: ${error.message}`);
    }
  }

  /**
   * Clean up temporary files
   * @param filePaths - Array of file paths to delete
   */
  async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          logger.info(`Cleaned up temp file: ${filePath}`);
        }
      } catch (error: any) {
        logger.error(`Error cleaning up temp file ${filePath}:`, error.message);
      }
    }
  }

  /**
   * Extract image URLs from Slack message
   * @param slackMessage - Slack message object
   * @returns Array of image URLs
   */
  extractImageUrls(slackMessage: SlackMessage): string[] {
    const imageUrls: string[] = [];
    
    // Check for files in the message
    if (slackMessage.files && Array.isArray(slackMessage.files)) {
      for (const file of slackMessage.files) {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
          // Use url_private for authenticated access
          imageUrls.push(file.url_private || file.url || '');
        }
      }
    }

    // Check for image attachments
    if (slackMessage.attachments && Array.isArray(slackMessage.attachments)) {
      for (const attachment of slackMessage.attachments) {
        if (attachment.image_url) {
          imageUrls.push(attachment.image_url);
        }
      }
    }

    // Check for image blocks
    if (slackMessage.blocks && Array.isArray(slackMessage.blocks)) {
      for (const block of slackMessage.blocks) {
        if (block.type === 'image' && (block as any).image_url) {
          imageUrls.push((block as any).image_url);
        }
      }
    }

    return imageUrls.filter(url => url.length > 0);
  }

  /**
   * Validate image buffer
   * @param buffer - Image buffer
   * @returns True if valid image
   */
  validateImageBuffer(buffer: Buffer): boolean {
    // Check if buffer is empty
    if (!buffer || buffer.length === 0) {
      return false;
    }

    // Check file signature (magic numbers)
    const signatures = [
      { type: 'jpeg', signature: [0xFF, 0xD8, 0xFF] },
      { type: 'png', signature: [0x89, 0x50, 0x4E, 0x47] },
      { type: 'gif', signature: [0x47, 0x49, 0x46] },
      { type: 'webp', signature: [0x52, 0x49, 0x46, 0x46] }
    ];

    for (const sig of signatures) {
      if (buffer.length >= sig.signature.length) {
        const header = buffer.slice(0, sig.signature.length);
        if (header.every((byte, index) => byte === sig.signature[index])) {
          return true;
        }
      }
    }

    return false;
  }
}

// Export singleton instance
export const imageDownloader = new ImageDownloader();
export default imageDownloader;
