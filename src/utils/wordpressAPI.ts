import axios, { AxiosInstance, AxiosResponse } from 'axios';
import FormData from 'form-data';
import { logger } from './logger';
import { 
  WordPressMedia, 
  WordPressPost, 
  WordPressPostData, 
  WordPressCategory, 
  WordPressTag 
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
   * Upload media to WordPress Media Library
   * @param imageData - Image buffer data
   * @param filename - Original filename
   * @returns Media object with ID and URL
   */
  async uploadMedia(imageData: Buffer, filename: string): Promise<WordPressMedia> {
    try {
      const form = new FormData();
      form.append('file', imageData, {
        filename: filename,
        contentType: 'image/jpeg' // You might want to detect this dynamically
      });

      const response: AxiosResponse = await axios.post(
        `${this.baseURL}/wp-json/wp/v2/media`,
        form,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': `multipart/form-data; charset=utf-8`,
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
      logger.error('Error uploading media to WordPress:', error.response?.data || error.message);
      throw new Error(`Failed to upload media: ${error.response?.data?.message || error.message}`);
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
      logger.error('Error creating post in WordPress:', error.response?.data || error.message);
      throw new Error(`Failed to create post: ${error.response?.data?.message || error.message}`);
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
