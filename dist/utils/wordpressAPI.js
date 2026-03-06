"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wordpressAPI = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const logger_1 = require("./logger");
const mime_types_1 = __importDefault(require("mime-types"));
const file_type_1 = __importDefault(require("file-type"));
const types_1 = require("../types");
class WordPressAPI {
    constructor() {
        this.baseURL = process.env.WP_URL;
        this.username = process.env.WP_USERNAME;
        this.password = process.env.WP_PASSWORD;
        this.auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        if (!this.baseURL || !this.username || !this.password) {
            throw new Error('WordPress configuration missing. Please check environment variables.');
        }
        this.axiosInstance = axios_1.default.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Basic ${this.auth}`,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
    }
    categorizeError(error, endpoint) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            return {
                name: 'WordPressError',
                message: `Không thể kết nối đến WordPress: ${error.message}`,
                type: types_1.WordPressErrorType.NETWORK,
                statusCode: 503,
                endpoint,
                response: error.response
            };
        }
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            switch (status) {
                case 401:
                    return {
                        name: 'WordPressError',
                        message: 'Lỗi xác thực WordPress: Tên đăng nhập hoặc mật khẩu không đúng',
                        type: types_1.WordPressErrorType.AUTHENTICATION,
                        statusCode: status,
                        endpoint,
                        response: data
                    };
                case 403:
                    return {
                        name: 'WordPressError',
                        message: 'Lỗi quyền truy cập WordPress: Tài khoản không có quyền đăng bài',
                        type: types_1.WordPressErrorType.AUTHENTICATION,
                        statusCode: status,
                        endpoint,
                        response: data
                    };
                case 400:
                case 422:
                    return {
                        name: 'WordPressError',
                        message: `Lỗi dữ liệu: ${data?.message || 'Dữ liệu không hợp lệ'}`,
                        type: types_1.WordPressErrorType.VALIDATION,
                        statusCode: status,
                        endpoint,
                        response: data
                    };
                case 413:
                    return {
                        name: 'WordPressError',
                        message: 'File quá lớn: Vui lòng giảm kích thước hình ảnh',
                        type: types_1.WordPressErrorType.MEDIA_UPLOAD,
                        statusCode: status,
                        endpoint,
                        response: data
                    };
                case 500:
                case 502:
                case 503:
                case 504:
                    return {
                        name: 'WordPressError',
                        message: `Lỗi máy chủ WordPress: ${data?.message || 'Máy chủ đang gặp sự cố'}`,
                        type: types_1.WordPressErrorType.SERVER_ERROR,
                        statusCode: status,
                        endpoint,
                        response: data
                    };
                default:
                    return {
                        name: 'WordPressError',
                        message: `Lỗi WordPress (${status}): ${data?.message || error.message}`,
                        type: types_1.WordPressErrorType.UNKNOWN,
                        statusCode: status,
                        endpoint,
                        response: data
                    };
            }
        }
        return {
            name: 'WordPressError',
            message: `Lỗi không xác định: ${error.message}`,
            type: types_1.WordPressErrorType.UNKNOWN,
            statusCode: 500,
            endpoint,
            response: error.response
        };
    }
    async uploadMedia(imageData, filename) {
        try {
            const form = new form_data_1.default();
            const mimeType = mime_types_1.default.lookup(filename) || 'application/octet-stream';
            form.append('file', imageData, {
                filename,
                contentType: mimeType
            });
            const detected = await file_type_1.default.fileTypeFromBuffer(imageData);
            console.log('Detected type:', detected);
            const response = await axios_1.default.post(`${this.baseURL}/wp-json/wp/v2/media`, form, {
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    ...form.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            logger_1.logger.info(`Media uploaded successfully: ${response.data.id}`);
            return {
                id: response.data.id,
                url: response.data.source_url,
                title: response.data.title.rendered,
                alt_text: response.data.alt_text || ''
            };
        }
        catch (error) {
            const wpError = this.categorizeError(error, '/wp-json/wp/v2/media');
            logger_1.logger.error('Error uploading media to WordPress:', wpError);
            throw wpError;
        }
    }
    async createPost(postData) {
        try {
            const payload = {
                title: postData.title,
                content: postData.content,
                status: postData.status || process.env.DEFAULT_POST_STATUS || 'draft',
                excerpt: postData.excerpt || ''
            };
            logger_1.logger.info('WordPress API payload title:', payload.title);
            logger_1.logger.info('WordPress API payload content:', payload.content);
            if (postData.featuredMedia) {
                payload.featured_media = postData.featuredMedia;
            }
            if (postData.categories && postData.categories.length > 0) {
                payload.categories = postData.categories;
            }
            else if (process.env.DEFAULT_CATEGORY_ID) {
                payload.categories = [parseInt(process.env.DEFAULT_CATEGORY_ID)];
            }
            if (postData.tags && postData.tags.length > 0) {
                payload.tags = postData.tags;
            }
            else if (process.env.DEFAULT_TAG_IDS) {
                payload.tags = process.env.DEFAULT_TAG_IDS.split(',').map(id => parseInt(id.trim()));
            }
            const response = await this.axiosInstance.post('/wp-json/wp/v2/posts', payload);
            logger_1.logger.info(`Post created successfully: ${response.data.id}`);
            logger_1.logger.info('WordPress response title:', response.data.title.rendered);
            return {
                id: response.data.id,
                title: response.data.title.rendered,
                content: response.data.content.rendered,
                status: response.data.status,
                link: response.data.link,
                featured_media: response.data.featured_media
            };
        }
        catch (error) {
            const wpError = this.categorizeError(error, '/wp-json/wp/v2/posts');
            logger_1.logger.error('Error creating post in WordPress:', wpError);
            throw wpError;
        }
    }
    async testConnection() {
        try {
            const response = await this.axiosInstance.get('/wp/v2/users/me');
            logger_1.logger.info(`WordPress connection successful. User: ${response.data.name}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('WordPress connection failed:', error.response?.data || error.message);
            return false;
        }
    }
    async getCategories() {
        try {
            const response = await this.axiosInstance.get('/wp/v2/categories');
            return response.data.map((cat) => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug
            }));
        }
        catch (error) {
            logger_1.logger.error('Error fetching categories:', error.response?.data || error.message);
            throw new Error(`Failed to fetch categories: ${error.response?.data?.message || error.message}`);
        }
    }
    async getTags() {
        try {
            const response = await this.axiosInstance.get('/wp/v2/tags');
            return response.data.map((tag) => ({
                id: tag.id,
                name: tag.name,
                slug: tag.slug
            }));
        }
        catch (error) {
            logger_1.logger.error('Error fetching tags:', error.response?.data || error.message);
            throw new Error(`Failed to fetch tags: ${error.response?.data?.message || error.message}`);
        }
    }
}
exports.wordpressAPI = new WordPressAPI();
exports.default = exports.wordpressAPI;
//# sourceMappingURL=wordpressAPI.js.map