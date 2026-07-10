import { Platform } from '@/types';

/**
 * Slack Block Kit Message Builders
 */
export class SlackMessageBuilder {

  /**
   * Build platform selection message using Block Kit
   */
  static buildPlatformSelection(messageId: string): any {
    return {
      text: "Chọn nền tảng để đăng bài:",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Chọn nền tảng để đăng bài từ Slack:*"
          }
        },
        {
          type: "actions",
          block_id: "platform_selection",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "🌐 Web"
              },
              value: `wordpress_${messageId}`,
              action_id: "select_platform_wordpress"
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "📘 Facebook"
              },
              value: `facebook_${messageId}`,
              action_id: "select_platform_facebook"
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "🌐 Tất cả (Web + Facebook)"
              },
              value: `all_${messageId}`,
              action_id: "select_platform_all"
            }
          ]
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💡 *Lưu ý:* Tin nhắn gốc sẽ được xử lý sau khi bạn chọn nền tảng. Thời hạn: 10 phút."
            }
          ]
        }
      ]
    };
  }

  /**
   * Build success message for platform posting
   */
  static buildSuccessMessage(
    platform: Platform,
    postUrl: string,
    postTitle: string
  ): any {
    const platformName = this.getPlatformDisplayName(platform);

    return {
      text: `✅ Đã đăng thành công lên ${platformName}!`,
      attachments: [
        {
          title: postTitle,
          title_link: postUrl,
          text: `Xem bài viết đầy đủ tại link trên`,
          color: "good",
          footer: platformName,
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  /**
   * Build error message for platform posting
   */
  static buildErrorMessage(
    platform: Platform,
    error: string
  ): any {
    const platformName = this.getPlatformDisplayName(platform);

    return {
      text: `❌ Lỗi đăng bài lên ${platformName}`,
      attachments: [
        {
          title: `Lỗi đăng bài ${platformName}`,
          text: error,
          color: "danger",
          footer: platformName,
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  /**
   * Build multi-platform success message
   */
  static buildMultiPlatformSuccessMessage(
    results: Array<{ platform: Platform; success: boolean; postUrl?: string; error?: string }>,
    title: string
  ): any {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    let text = `✅ Đã xử lý đăng bài`;
    let color = "good";

    if (failed.length > 0 && successful.length > 0) {
      text = `⚠️ Đăng bài một phần thành công`;
      color = "warning";
    } else if (failed.length > 0) {
      text = `❌ Đăng bài thất bại`;
      color = "danger";
    }

    const fields = results.map(result => ({
      title: this.getPlatformDisplayName(result.platform),
      value: result.success
        ? `✅ <${result.postUrl}|Xem bài viết>`
        : `❌ ${result.error}`,
      short: true
    }));

    return {
      text,
      attachments: [
        {
          title,
          color,
          fields,
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  /**
   * Build confirmation message for platform selection
   */
  static buildSelectionConfirmation(platform: Platform): any {
    const platformName = this.getPlatformDisplayName(platform);

    return {
      text: `✅ Đã chọn nền tảng: ${platformName}`,
      attachments: [
        {
          text: `Bắt đầu xử lý đăng bài lên ${platformName}...`,
          color: "good",
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  /**
   * Get display name for platform
   */
  private static getPlatformDisplayName(platform: Platform): string {
    switch (platform) {
      case Platform.WORDPRESS:
        return "WordPress";
      case Platform.FACEBOOK:
        return "Facebook";
      case Platform.ALL:
        return "Tất cả nền tảng";
      default:
        return platform;
    }
  }
}