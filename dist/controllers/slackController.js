"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slackController = void 0;
const logger_1 = require("@/utils/logger");
const wordpressAPI_1 = require("@/utils/wordpressAPI");
const imageDownloader_1 = require("@/utils/imageDownloader");
const emoji_js_1 = __importDefault(require("emoji-js"));
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
                .catch(error => {
                logger_1.logger.error('Error processing Slack message:', error);
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
                    .catch(error => {
                    logger_1.logger.error('Error processing Slack event:', error);
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
            try {
                logger_1.logger.info(`Processing Slack message (attempt ${attempt}/${maxRetries})`);
                const messageText = this.extractMessageText(slackMessage);
                const imageUrls = imageDownloader_1.imageDownloader.extractImageUrls(slackMessage);
                const uploadedImages = await this.processImages(imageUrls);
                const postResult = await this.createWordPressPost(messageText, uploadedImages, slackMessage);
                return {
                    success: true,
                    postId: postResult.id,
                    postUrl: postResult.link,
                    imagesUploaded: uploadedImages.length,
                    attempt: attempt
                };
            }
            catch (error) {
                logger_1.logger.error(`Attempt ${attempt} failed:`, error.message);
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
                    logger_1.logger.info(`Image uploaded to WordPress: ${uploadedImage.url}`);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to upload image ${image.filename}:`, error.message);
                }
            }
            return uploadedImages;
        }
        finally {
            if (tempFiles.length > 0) {
                await imageDownloader_1.imageDownloader.cleanupTempFiles(tempFiles);
            }
        }
    }
    async createWordPressPost(messageText, uploadedImages, slackMessage) {
        const title = messageText.length > 50
            ? messageText.substring(0, 50) + '...'
            : messageText || 'Slack Message';
        let content = `<p>${messageText.replace(/\n/g, '<br>')}</p>`;
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
        content += '\n<hr />';
        content += '\n<div class="slack-metadata">';
        content += `\n<p><small><em>Posted from Slack`;
        if (slackMessage.user) {
            content += ` by user ${slackMessage.user}`;
        }
        if (slackMessage.channel) {
            content += ` in channel ${slackMessage.channel}`;
        }
        content += ` on ${new Date().toLocaleString()}</em></small></p>`;
        content += '\n</div>';
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
            link: result.link
        };
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.slackController = new SlackController();
exports.default = exports.slackController;
//# sourceMappingURL=slackController.js.map