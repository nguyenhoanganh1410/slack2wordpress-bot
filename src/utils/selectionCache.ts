import { PendingSelection, SlackWebhookPayload } from '@/types';

/**
 * In-memory cache for pending platform selections
 * In production, consider using Redis for distributed cache
 */
export class SelectionCache {
  private cache: Map<string, PendingSelection> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Generate cache key from user and channel
   */
  private getKey(userId: string, channelId: string): string {
    return `${userId}:${channelId}`;
  }

  /**
   * Store a pending selection
   */
  set(userId: string, channelId: string, originalMessage: SlackWebhookPayload): void {
    const key = this.getKey(userId, channelId);
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes TTL

    this.cache.set(key, {
      userId,
      channelId,
      originalMessage,
      timestamp: Date.now(),
      expiresAt
    });
  }

  /**
   * Get a pending selection
   */
  get(userId: string, channelId: string): PendingSelection | undefined {
    const key = this.getKey(userId, channelId);
    const selection = this.cache.get(key);

    if (selection && Date.now() > selection.expiresAt) {
      // Expired, remove it
      this.cache.delete(key);
      return undefined;
    }

    return selection;
  }

  /**
   * Remove a pending selection
   */
  delete(userId: string, channelId: string): void {
    const key = this.getKey(userId, channelId);
    this.cache.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, selection] of this.cache.entries()) {
      if (now > selection.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size for monitoring
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Destroy the cache and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Export singleton instance
export const selectionCache = new SelectionCache();