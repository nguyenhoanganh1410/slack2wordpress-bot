"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageDownloader = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./logger");
class ImageDownloader {
    constructor() {
        this.slackToken = process.env.SLACK_BOT_TOKEN;
        this.tempDir = path_1.default.join(__dirname, '../../temp');
        if (!fs_1.default.existsSync(this.tempDir)) {
            fs_1.default.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    async downloadImage(imageUrl, filename) {
        try {
            logger_1.logger.info(`Downloading image from: ${imageUrl}`);
            const headers = {};
            if (imageUrl.includes('files.slack.com') && this.slackToken) {
                headers['Authorization'] = `Bearer ${this.slackToken}`;
            }
            logger_1.logger.info(JSON.stringify(headers));
            const response = await axios_1.default.get(imageUrl, {
                responseType: 'arraybuffer',
                headers,
                timeout: 30000
            });
            const buffer = Buffer.from(response.data);
            logger_1.logger.info(`Response status: ${response.status}`);
            logger_1.logger.info(`Final URL: ${response.request?.res?.responseUrl || imageUrl}`);
            logger_1.logger.info(`Content-Type: ${response.headers['content-type']}`);
            if (!filename) {
                const urlParts = imageUrl.split('/');
                filename = urlParts[urlParts.length - 1] || `image_${Date.now()}`;
                const contentType = response.headers['content-type'];
                if (contentType && contentType.startsWith('image/') && !filename.includes('.')) {
                    const extension = contentType.split('/')[1];
                    filename += `.${extension}`;
                }
            }
            logger_1.logger.info(`Image downloaded successfully. Size: ${buffer.length} bytes`);
            return { buffer, filename };
        }
        catch (error) {
            logger_1.logger.error(`Error downloading image from ${imageUrl}:`, error.message);
            throw new Error(`Failed to download image: ${error.message}`);
        }
    }
    async downloadMultipleImages(imageUrls) {
        const results = [];
        for (let i = 0; i < imageUrls.length; i++) {
            try {
                const image = await this.downloadImage(imageUrls[i], `image_${i + 1}.jpg`);
                results.push(image);
            }
            catch (error) {
                logger_1.logger.error(`Failed to download image ${i + 1}:`, error.message);
            }
        }
        return results;
    }
    async saveToTemp(buffer, filename) {
        try {
            const filePath = path_1.default.join(this.tempDir, filename);
            await fs_1.default.promises.writeFile(filePath, buffer);
            logger_1.logger.info(`Image saved to temp file: ${filePath}`);
            return filePath;
        }
        catch (error) {
            logger_1.logger.error(`Error saving image to temp file:`, error.message);
            throw new Error(`Failed to save image: ${error.message}`);
        }
    }
    async cleanupTempFiles(filePaths) {
        for (const filePath of filePaths) {
            try {
                if (fs_1.default.existsSync(filePath)) {
                    await fs_1.default.promises.unlink(filePath);
                    logger_1.logger.info(`Cleaned up temp file: ${filePath}`);
                }
            }
            catch (error) {
                logger_1.logger.error(`Error cleaning up temp file ${filePath}:`, error.message);
            }
        }
    }
    extractImageUrls(slackMessage) {
        const imageUrls = [];
        if (slackMessage.files && Array.isArray(slackMessage.files)) {
            for (const file of slackMessage.files) {
                if (file.mimetype && file.mimetype.startsWith('image/')) {
                    imageUrls.push(file.url_private || file.url || '');
                }
            }
        }
        if (slackMessage.attachments && Array.isArray(slackMessage.attachments)) {
            for (const attachment of slackMessage.attachments) {
                if (attachment.image_url) {
                    imageUrls.push(attachment.image_url);
                }
            }
        }
        if (slackMessage.blocks && Array.isArray(slackMessage.blocks)) {
            for (const block of slackMessage.blocks) {
                if (block.type === 'image' && block.image_url) {
                    imageUrls.push(block.image_url);
                }
            }
        }
        return imageUrls.filter(url => url.length > 0);
    }
    validateImageBuffer(buffer) {
        if (!buffer || buffer.length === 0) {
            return false;
        }
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
exports.imageDownloader = new ImageDownloader();
exports.default = exports.imageDownloader;
//# sourceMappingURL=imageDownloader.js.map