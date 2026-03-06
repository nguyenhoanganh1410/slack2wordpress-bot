"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slackController = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const wordpressAPI_1 = require("../utils/wordpressAPI");
const imageDownloader_1 = require("../utils/imageDownloader");
const emoji_js_1 = __importDefault(require("emoji-js"));
const types_1 = require("../types");
const contentUtils_1 = require("../utils/contentUtils");
class SlackController {
    async handleSlackWebhook(req, res) {
        try {
            const slackData = req.body;
            logger_1.logger.info('Received Slack webhook:', JSON.stringify(slackData, null, 2));
            if (!slackData.text && !slackData.attachments && !slackData.files) {
                res.status(400).json({
                    success: false,
                    error: 'No content found in Slack message'
                });
                return;
            }
            this.processSlackMessage(slackData)
                .then(result => {
                logger_1.logger.info('Slack message processed successfully:', result);
            })
                .catch(async (error) => {
                logger_1.logger.error('Error processing Slack message:', error);
                await this.sendSlackErrorResponse(error, parseInt(process.env.MAX_RETRIES || '3', 10), parseInt(process.env.MAX_RETRIES || '3', 10));
            });
            res.status(200).json({
                success: true,
                message: 'Message received and will be processed'
            });
        }
        catch (error) {
            logger_1.logger.error('Error in Slack webhook handler:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
    async handleSlackEvent(req, res) {
        try {
            const { type, challenge, event } = req.body;
            if (type === 'url_verification') {
                res.status(200).send(challenge);
                return;
            }
            if (type === 'event_callback' && event?.type === 'message') {
                if (event.bot_id || event.subtype === 'bot_message') {
                    res.status(200).send('OK');
                    return;
                }
                logger_1.logger.info('Received Slack event:', event);
                this.processSlackMessage(event)
                    .then(result => {
                    logger_1.logger.info('Slack event processed successfully:', result);
                })
                    .catch(async (error) => {
                    logger_1.logger.error('Error processing Slack event:', error);
                    await this.sendSlackErrorResponse(error, parseInt(process.env.MAX_RETRIES || '3', 10), parseInt(process.env.MAX_RETRIES || '3', 10));
                });
            }
            res.status(200).send('OK');
        }
        catch (error) {
            logger_1.logger.error('Error in Slack event handler:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
    async processSlackMessage(slackMessage) {
        const maxRetries = parseInt(process.env.MAX_RETRIES || '3', 10);
        const retryDelay = parseInt(process.env.RETRY_DELAY || '1000', 10);
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let imageUrls = [];
            try {
                logger_1.logger.info(`Processing Slack message (attempt ${attempt}/${maxRetries})`);
                const titleContent = (0, contentUtils_1.extractTitle)(slackMessage.text || '');
                logger_1.logger.info(`Title content: ${titleContent}`);
                const messageText = this.extractMessageText(slackMessage);
                imageUrls = imageDownloader_1.imageDownloader.extractImageUrls(slackMessage);
                const uploadedImages = await this.processImages(imageUrls);
                const postResult = await this.createWordPressPost(messageText, uploadedImages, titleContent);
                const slackResponseSent = await this.sendSlackResponse(postResult.link, postResult.title || 'Bài viết mới');
                return {
                    success: true,
                    postId: postResult.id,
                    postUrl: postResult.link,
                    imagesUploaded: uploadedImages.length,
                    attempt: attempt,
                    slackResponseSent: slackResponseSent
                };
            }
            catch (error) {
                logger_1.logger.error(`Attempt ${attempt} failed:`, error.message);
                let partialSuccess;
                if (imageUrls && imageUrls.length > 0) {
                    partialSuccess = {
                        imagesUploaded: 0,
                        totalImages: imageUrls.length
                    };
                }
                await this.sendSlackErrorResponse(error, attempt, maxRetries, partialSuccess);
                if (attempt === maxRetries) {
                    throw error;
                }
                await this.sleep(retryDelay * attempt);
            }
        }
        throw new Error('Max retries exceeded');
    }
    convertSlackShortcodesToUnicode(text) {
        const emoji = new emoji_js_1.default();
        emoji.replace_mode = 'unified';
        emoji.allow_native = true;
        emoji.include_title = false;
        emoji.include_text = false;
        let convertedText = emoji.replace_colons(text);
        const fallbackMap = {
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
        logger_1.logger.info('Converted text from shortcodes to Unicode:', {
            original: text,
            converted: convertedText
        });
        return convertedText;
    }
    extractMessageText(slackMessage) {
        let text = slackMessage.text || '';
        logger_1.logger.info('Original Slack text:', text);
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
        logger_1.logger.info('Final extracted text:', finalText);
        return finalText;
    }
    async processImages(imageUrls) {
        const uploadedImages = [];
        const tempFiles = [];
        let successCount = 0;
        let failureCount = 0;
        try {
            if (imageUrls.length === 0) {
                return uploadedImages;
            }
            logger_1.logger.info(`Processing ${imageUrls.length} images`);
            const downloadedImages = await imageDownloader_1.imageDownloader.downloadMultipleImages(imageUrls);
            for (const image of downloadedImages) {
                try {
                    const uploadedImage = await wordpressAPI_1.wordpressAPI.uploadMedia(image.buffer, image.filename);
                    uploadedImages.push(uploadedImage);
                    successCount++;
                    logger_1.logger.info(`Image uploaded to WordPress: ${uploadedImage.url}`);
                }
                catch (error) {
                    failureCount++;
                    logger_1.logger.error(`Failed to upload image ${image.filename}:`, error.message);
                }
            }
            logger_1.logger.info(`Image processing complete: ${successCount} successful, ${failureCount} failed`);
            if (failureCount === imageUrls.length && imageUrls.length > 0) {
                throw new Error(`Failed to upload all ${imageUrls.length} images to WordPress`);
            }
            return uploadedImages;
        }
        finally {
            if (tempFiles.length > 0) {
                await imageDownloader_1.imageDownloader.cleanupTempFiles(tempFiles);
            }
        }
    }
    async createWordPressPost(messageText, uploadedImages, title) {
        if (!title) {
            title = messageText.length > 50
                ? messageText.substring(0, 50) + '...'
                : messageText || 'Slack Message';
        }
        let content = `<p>${messageText.replace(/\n/g, '<br>')}</p>`;
        if (uploadedImages.length > 0) {
            content += '\n<div class="slack-images">';
            for (const image of uploadedImages) {
                content += `\n<figure class="slack-image">
          <img src="${image.url}" alt="${image.alt_text || 'Slack image'}" />
        </figure>`;
            }
            content += '\n</div>';
        }
        const postData = {
            title: title,
            content: content,
            status: process.env.DEFAULT_POST_STATUS || 'draft'
        };
        logger_1.logger.info('Post title with emojis:', title);
        logger_1.logger.info('Post content with emojis:', content);
        if (uploadedImages.length > 0) {
            postData.featuredMedia = uploadedImages[0].id;
        }
        const result = await wordpressAPI_1.wordpressAPI.createPost(postData);
        return {
            id: result.id,
            link: result.link,
            title: result.title
        };
    }
    async sendSlackResponse(postUrl, postTitle) {
        try {
            const webhookUrl = process.env.SLACK_RESPONSE_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
            if (!webhookUrl) {
                logger_1.logger.warn('No Slack webhook URL configured for response');
                return false;
            }
            const responsePayload = {
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
            await axios_1.default.post(webhookUrl, responsePayload);
            logger_1.logger.info(`Slack response sent successfully for post: ${postUrl}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to send Slack response:', error.response?.data || error.message);
            return false;
        }
    }
    async sendSlackErrorResponse(error, attempt, maxRetries, partialSuccess) {
        try {
            const webhookUrl = process.env.SLACK_RESPONSE_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
            if (!webhookUrl) {
                logger_1.logger.warn('No Slack webhook URL configured for error response');
                return false;
            }
            let errorIcon = '❌';
            let errorColor = 'danger';
            let errorTitle = 'Lỗi đăng bài WordPress';
            let errorMessage = error.message || 'Lỗi không xác định';
            let suggestion = '';
            if (error.type) {
                switch (error.type) {
                    case types_1.WordPressErrorType.AUTHENTICATION:
                        errorIcon = '🔐';
                        errorTitle = 'Lỗi xác thực WordPress';
                        suggestion = 'Kiểm tra lại tên đăng nhập và mật khẩu WordPress trong cấu hình';
                        break;
                    case types_1.WordPressErrorType.NETWORK:
                        errorIcon = '🌐';
                        errorTitle = 'Lỗi kết nối WordPress';
                        suggestion = 'Kiểm tra kết nối mạng và URL của trang WordPress';
                        errorColor = 'warning';
                        break;
                    case types_1.WordPressErrorType.VALIDATION:
                        errorIcon = '⚠️';
                        errorTitle = 'Lỗi dữ liệu';
                        suggestion = 'Kiểm tra lại nội dung bài viết, có thể chứa ký tự không hợp lệ';
                        errorColor = 'warning';
                        break;
                    case types_1.WordPressErrorType.MEDIA_UPLOAD:
                        errorIcon = '🖼️';
                        errorTitle = 'Lỗi tải ảnh lên';
                        suggestion = 'Kiểm tra kích thước và định dạng file ảnh';
                        errorColor = 'warning';
                        break;
                    case types_1.WordPressErrorType.SERVER_ERROR:
                        errorIcon = '🔥';
                        errorTitle = 'Lỗi máy chủ WordPress';
                        suggestion = 'Máy chủ WordPress đang gặp sự cố, vui lòng thử lại sau';
                        break;
                }
            }
            const fields = [
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
            if (partialSuccess && partialSuccess.imagesUploaded > 0) {
                fields.push({
                    title: 'Ảnh đã tải lên',
                    value: `${partialSuccess.imagesUploaded}/${partialSuccess.totalImages}`,
                    short: true
                });
            }
            if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DETAILED_ERRORS === 'true') {
                fields.push({
                    title: 'Chi tiết lỗi',
                    value: `\`${error.endpoint || 'N/A'}\`\n\`${error.statusCode || 'N/A'}\``,
                    short: false
                });
            }
            const errorResponsePayload = {
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
            if (process.env.SLACK_ERROR_MENTION_USER && error.type !== types_1.WordPressErrorType.VALIDATION) {
                errorResponsePayload.text = `<@${process.env.SLACK_ERROR_MENTION_USER}> ${errorResponsePayload.text}`;
            }
            await axios_1.default.post(webhookUrl, errorResponsePayload);
            logger_1.logger.info(`Slack error response sent successfully for attempt: ${attempt}/${maxRetries}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to send Slack error response:', error.response?.data || error.message);
            return false;
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.slackController = new SlackController();
exports.default = exports.slackController;
//# sourceMappingURL=slackController.js.map