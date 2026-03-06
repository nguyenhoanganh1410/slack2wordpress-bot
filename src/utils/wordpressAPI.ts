import axios, { AxiosInstance, AxiosResponse } from 'axios';
import FormData from 'form-data';
import { logger } from './logger';
import mime from 'mime-types';
import fileType from 'file-type';

import {
  WordPressMedia,
  WordPressPost,
  WordPressPostData,
  WordPressCategory,
  WordPressTag,
  WordPressError,
  WordPressErrorType
} from '@/types';

class WordPressAPI {
  private baseURL: string;
  private username: string;
  private password: string;
  private auth: string;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.baseURL = process.env.WP_URL!;
    this.username = process.env.WP_USERNAME!;
    this.password = process.env.WP_PASSWORD!;
    this.auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');

    if (!this.baseURL || !this.username || !this.password) {
      throw new Error('WordPress configuration missing. Please check environment variables.');
    }

    // Create axios instance with default configuration
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }

  /**
   * Categorize WordPress API errors for better handling
   * @param error - The original error from axios or other sources
   * @param endpoint - The API endpoint that was being called
   * @returns Categorized WordPressError
   */
  private categorizeError(error: any, endpoint: string): WordPressError {
    // Network/Connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return {
        name: 'WordPressError',
        message: `Không thể kết nối đến WordPress: ${error.message}`,
        type: WordPressErrorType.NETWORK,
        statusCode: 503,
        endpoint,
        response: error.response
      };
    }

    // HTTP response errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          return {
            name: 'WordPressError',
            message: 'Lỗi xác thực WordPress: Tên đăng nhập hoặc mật khẩu không đúng',
            type: WordPressErrorType.AUTHENTICATION,
            statusCode: status,
            endpoint,
            response: data
          };
        
        case 403:
          return {
            name: 'WordPressError',
            message: 'Lỗi quyền truy cập WordPress: Tài khoản không có quyền đăng bài',
            type: WordPressErrorType.AUTHENTICATION,
            statusCode: status,
            endpoint,
            response: data
          };
        
        case 400:
        case 422:
          return {
            name: 'WordPressError',
            message: `Lỗi dữ liệu: ${data?.message || 'Dữ liệu không hợp lệ'}`,
            type: WordPressErrorType.VALIDATION,
            statusCode: status,
            endpoint,
            response: data
          };
        
        case 413:
          return {
            name: 'WordPressError',
            message: 'File quá lớn: Vui lòng giảm kích thước hình ảnh',
            type: WordPressErrorType.MEDIA_UPLOAD,
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
            type: WordPressErrorType.SERVER_ERROR,
            statusCode: status,
            endpoint,
            response: data
          };
        
        default:
          return {
            name: 'WordPressError',
            message: `Lỗi WordPress (${status}): ${data?.message || error.message}`,
            type: WordPressErrorType.UNKNOWN,
            statusCode: status,
            endpoint,
            response: data
          };
      }
    }

    // Other errors
    return {
      name: 'WordPressError',
      message: `Lỗi không xác định: ${error.message}`,
      type: WordPressErrorType.UNKNOWN,
      statusCode: 500,
      endpoint,
      response: error.response
    };
  }

  /**
   * Upload media to WordPress Media Library
   * @param imageData - Image buffer data
   * @param filename - Original filename
   * @returns Media object with ID and URL
   */
  // async uploadMedia(imageData: Buffer, filename: string): Promise<WordPressMedia> {
  //   try {
  //     const form = new FormData();
  //     form.append('file', imageData, {
  //       filename: filename,
  //       contentType: 'image/jpeg' // You might want to detect this dynamically
  //     });

  //     const response: AxiosResponse = await axios.post(
  //       `${this.baseURL}/wp-json/wp/v2/media`,
  //       form,
  //       {
  //         headers: {
  //           'Authorization': `Basic ${this.auth}`,
  //           'Content-Type': `multipart/form-data; charset=utf-8`,
  //           ...form.getHeaders()
  //         },
  //         maxContentLength: Infinity,
  //         maxBodyLength: Infinity
  //       }
  //     );

  //     logger.info(`Media uploaded successfully: ${response.data.id}`);

  //     return {
  //       id: response.data.id,
  //       url: response.data.source_url,
  //       title: response.data.title.rendered,
  //       alt_text: response.data.alt_text || ''
  //     };
  //   } catch (error: any) {
  //     logger.error('Error uploading media to WordPress:', error.response?.data || error.message);
  //     throw new Error(`Failed to upload media: ${error.response?.data?.message || error.message}`);
  //   }
  // }

  async uploadMedia(imageData: Buffer, filename: string): Promise<WordPressMedia> {
    try {
      const form = new FormData();

      const mimeType = mime.lookup(filename) || 'application/octet-stream';

      form.append('file', imageData, {
        filename,
        contentType: mimeType
      });

      const detected = await fileType.fileTypeFromBuffer(imageData);
      console.log('Detected type:', detected);

      const response: AxiosResponse = await axios.post(
        `${this.baseURL}/wp-json/wp/v2/media`,
        form,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            ...form.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      logger.info(`Media uploaded successfully: ${response.data.id}`);

      return {
        id: response.data.id,
        url: response.data.source_url,
        title: response.data.title.rendered,
        alt_text: response.data.alt_text || ''
      };
    } catch (error: any) {
      const wpError = this.categorizeError(error, '/wp-json/wp/v2/media');
      logger.error('Error uploading media to WordPress:', wpError);
      throw wpError;
    }
  }

  /**
   * Create a new WordPress post
   * @param postData - Post data
   * @returns Created post object
   */
  async createPost(postData: WordPressPostData): Promise<WordPressPost> {
    try {
      const payload: any = {
        title: postData.title,
        content: postData.content,
        status: postData.status || process.env.DEFAULT_POST_STATUS || 'draft',
        excerpt: postData.excerpt || ''
      };

      // Log payload for debugging emoji preservation
      logger.info('WordPress API payload title:', payload.title);
      logger.info('WordPress API payload content:', payload.content);

      // Add featured image if provided
      if (postData.featuredMedia) {
        payload.featured_media = postData.featuredMedia;
      }

      // Add categories if provided
      if (postData.categories && postData.categories.length > 0) {
        payload.categories = postData.categories;
      } else if (process.env.DEFAULT_CATEGORY_ID) {
        payload.categories = [parseInt(process.env.DEFAULT_CATEGORY_ID)];
      }

      // Add tags if provided
      if (postData.tags && postData.tags.length > 0) {
        payload.tags = postData.tags;
      } else if (process.env.DEFAULT_TAG_IDS) {
        payload.tags = process.env.DEFAULT_TAG_IDS.split(',').map(id => parseInt(id.trim()));
      }

      const response: AxiosResponse = await this.axiosInstance.post('/wp-json/wp/v2/posts', payload);

      logger.info(`Post created successfully: ${response.data.id}`);
      logger.info('WordPress response title:', response.data.title.rendered);

      return {
        id: response.data.id,
        title: response.data.title.rendered,
        content: response.data.content.rendered,
        status: response.data.status,
        link: response.data.link,
        featured_media: response.data.featured_media
      };
    } catch (error: any) {
      const wpError = this.categorizeError(error, '/wp-json/wp/v2/posts');
      logger.error('Error creating post in WordPress:', wpError);
      throw wpError;
    }
  }

  /**
   * Test WordPress connection
   * @returns Connection status
   */
  async testConnection(): Promise<boolean> {
    try {
      const response: AxiosResponse = await this.axiosInstance.get('/wp/v2/users/me');
      logger.info(`WordPress connection successful. User: ${response.data.name}`);
      return true;
    } catch (error: any) {
      logger.error('WordPress connection failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Get WordPress categories
   * @returns List of categories
   */
  async getCategories(): Promise<WordPressCategory[]> {
    try {
      const response: AxiosResponse = await this.axiosInstance.get('/wp/v2/categories');
      return response.data.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug
      }));
    } catch (error: any) {
      logger.error('Error fetching categories:', error.response?.data || error.message);
      throw new Error(`Failed to fetch categories: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get WordPress tags
   * @returns List of tags
   */
  async getTags(): Promise<WordPressTag[]> {
    try {
      const response: AxiosResponse = await this.axiosInstance.get('/wp/v2/tags');
      return response.data.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug
      }));
    } catch (error: any) {
      logger.error('Error fetching tags:', error.response?.data || error.message);
      throw new Error(`Failed to fetch tags: ${error.response?.data?.message || error.message}`);
    }
  }
}

// Export singleton instance
export const wordpressAPI = new WordPressAPI();
export default wordpressAPI;
