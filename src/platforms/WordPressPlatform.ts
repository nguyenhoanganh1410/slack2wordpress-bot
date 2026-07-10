import { IPlatform } from './IPlatform';
import { Platform, PlatformResult, PlatformConfig } from '@/types';
import { wordpressAPI } from '@/utils/wordpressAPI';
import { logger } from '@/utils/logger';

/**
 * WordPress Platform Implementation
 */
export class WordPressPlatform implements IPlatform {
  getName(): Platform {
    return Platform.WORDPRESS;
  }

  validateConfig(config: PlatformConfig): boolean {
    const wpConfig = config.wordpress;
    return !!(
      wpConfig &&
      wpConfig.url &&
      wpConfig.username &&
      wpConfig.password
    );
  }

  isEnabled(config: PlatformConfig): boolean {
    return this.validateConfig(config);
  }

  async postContent(
    content: string,
    title: string,
    images: Array<{ id: number; url: string; alt_text: string }>,
    config: PlatformConfig
  ): Promise<PlatformResult> {
    try {
      if (!this.validateConfig(config)) {
        throw new Error('WordPress configuration is invalid');
      }

      const wpConfig = config.wordpress!;

      // Build HTML content with embedded images
      let htmlContent = `<p>${content.replace(/\n/g, '<br>')}</p>`;

      // Add images to content
      if (images.length > 0) {
        htmlContent += '\n<div class="slack-images">';
        for (const image of images) {
          htmlContent += `\n<figure class="slack-image">
            <img src="${image.url}" alt="${image.alt_text || 'Slack image'}" />
          </figure>`;
        }
        htmlContent += '\n</div>';
      }

      // Create post data
      const postData = {
        title,
        content: htmlContent,
        status: wpConfig.defaultPostStatus || 'draft'
      };

      // Add featured image (first uploaded image)
      if (images.length > 0) {
        (postData as any).featuredMedia = images[0].id;
      }

      // Add categories and tags if configured
      if (wpConfig.defaultCategoryId) {
        (postData as any).categories = [wpConfig.defaultCategoryId];
      }

      if (wpConfig.defaultTagIds && wpConfig.defaultTagIds.length > 0) {
        (postData as any).tags = wpConfig.defaultTagIds;
      }

      logger.info('Creating WordPress post:', { title, imageCount: images.length });

      // Create the post using existing wordpressAPI
      const result = await wordpressAPI.createPost(postData);

      return {
        platform: Platform.WORDPRESS,
        success: true,
        postId: result.id.toString(),
        postUrl: result.link
      };

    } catch (error: any) {
      logger.error('WordPress posting failed:', error);

      return {
        platform: Platform.WORDPRESS,
        success: false,
        error: error.message || 'Failed to post to WordPress'
      };
    }
  }

  getPostUrl(postId: string): string {
    // This would need the WordPress URL from config
    // For now, return a placeholder
    return `wordpress-post-${postId}`;
  }
}