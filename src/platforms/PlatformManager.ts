import { IPlatform } from './IPlatform';
import { WordPressPlatform } from './WordPressPlatform';
import { FacebookPlatform } from './FacebookPlatform';
import { Platform, PlatformResult, PlatformConfig, MultiPlatformResult } from '@/types';
import { logger } from '@/utils/logger';

/**
 * Platform Manager
 * Manages multiple platform implementations and handles multi-platform posting
 */
export class PlatformManager {
  private platforms: Map<Platform, IPlatform> = new Map();

  constructor() {
    // Register platform implementations
    this.registerPlatform(new WordPressPlatform());
    this.registerPlatform(new FacebookPlatform());
  }

  /**
   * Register a platform implementation
   */
  registerPlatform(platform: IPlatform): void {
    this.platforms.set(platform.getName(), platform);
    logger.info(`Registered platform: ${platform.getName()}`);
  }

  /**
   * Get a platform implementation
   */
  getPlatform(name: Platform): IPlatform | undefined {
    return this.platforms.get(name);
  }

  /**
   * Get all registered platforms
   */
  getAllPlatforms(): Platform[] {
    return Array.from(this.platforms.keys());
  }

  /**
   * Check if a platform is available and configured
   */
  isPlatformAvailable(platform: Platform, config: PlatformConfig): boolean {
    const platformImpl = this.platforms.get(platform);
    return platformImpl ? platformImpl.isEnabled(config) : false;
  }

  /**
   * Post content to a single platform
   */
  async postToPlatform(
    platform: Platform,
    content: string,
    title: string,
    images: Array<{ id: number; url: string; alt_text: string }>,
    config: PlatformConfig
  ): Promise<PlatformResult> {
    const platformImpl = this.platforms.get(platform);

    if (!platformImpl) {
      return {
        platform,
        success: false,
        error: `Platform ${platform} is not supported`
      };
    }

    if (!platformImpl.isEnabled(config)) {
      return {
        platform,
        success: false,
        error: `Platform ${platform} is not configured or enabled`
      };
    }

    logger.info(`Posting to ${platform}:`, { title, contentLength: content.length, imageCount: images.length });

    return await platformImpl.postContent(content, title, images, config);
  }

  /**
   * Post content to multiple platforms
   */
  async postToMultiplePlatforms(
    platforms: Platform[],
    content: string,
    title: string,
    images: Array<{ id: number; url: string; alt_text: string }>,
    config: PlatformConfig
  ): Promise<MultiPlatformResult> {
    const results: PlatformResult[] = [];
    let hasSuccess = false;
    let hasFailure = false;

    logger.info(`Posting to multiple platforms:`, platforms);

    // Post to each platform concurrently
    const promises = platforms.map(platform =>
      this.postToPlatform(platform, content, title, images, config)
    );

    const platformResults = await Promise.all(promises);

    for (const result of platformResults) {
      results.push(result);
      if (result.success) {
        hasSuccess = true;
      } else {
        hasFailure = true;
      }
    }

    return {
      success: hasSuccess, // Success if at least one platform succeeded
      platforms: results,
      // Include error summary if there were failures
      ...(hasFailure && {
        error: `Some platforms failed: ${results.filter(r => !r.success).map(r => r.error).join('; ')}`
      })
    };
  }

  /**
   * Post content to "all" platforms (WordPress + Facebook)
   */
  async postToAll(
    content: string,
    title: string,
    images: Array<{ id: number; url: string; alt_text: string }>,
    config: PlatformConfig
  ): Promise<MultiPlatformResult> {
    const availablePlatforms = this.getAllPlatforms().filter(platform =>
      this.isPlatformAvailable(platform, config)
    );

    if (availablePlatforms.length === 0) {
      return {
        success: false,
        platforms: [],
        error: 'No platforms are configured and available'
      };
    }

    logger.info(`Posting to all available platforms:`, availablePlatforms);

    return await this.postToMultiplePlatforms(availablePlatforms, content, title, images, config);
  }

  /**
   * Validate configuration for all platforms
   */
  validateAllConfigs(config: PlatformConfig): { [key in Platform]?: boolean } {
    const validation: { [key in Platform]?: boolean } = {};

    for (const [platformName, platformImpl] of this.platforms) {
      validation[platformName] = platformImpl.validateConfig(config);
    }

    return validation;
  }
}

// Export singleton instance
export const platformManager = new PlatformManager();