import { Platform, PlatformResult, PlatformConfig } from '@/types';

/**
 * Platform Interface
 * Defines the contract for all platform implementations
 */
export interface IPlatform {
  /**
   * Get the platform name
   */
  getName(): Platform;

  /**
   * Validate platform configuration
   */
  validateConfig(config: PlatformConfig): boolean;

  /**
   * Post content to the platform
   * @param content - Text content to post
   * @param title - Title for the post
   * @param images - Array of image URLs already uploaded to the platform
   * @param config - Platform-specific configuration
   * @returns Platform result
   */
  postContent(
    content: string,
    title: string,
    images: Array<{ id: number; url: string; alt_text: string }>,
    config: PlatformConfig
  ): Promise<PlatformResult>;

  /**
   * Get the URL of a posted content
   * @param postId - Platform-specific post ID
   * @returns Full URL to the post
   */
  getPostUrl(postId: string): string;

  /**
   * Check if the platform is enabled/configured
   */
  isEnabled(config: PlatformConfig): boolean;
}