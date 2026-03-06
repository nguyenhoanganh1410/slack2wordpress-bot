import { WordPressMedia, WordPressPost, WordPressPostData, WordPressCategory, WordPressTag } from '../types';
declare class WordPressAPI {
    private baseURL;
    private username;
    private password;
    private auth;
    private axiosInstance;
    constructor();
    uploadMedia(imageData: Buffer, filename: string): Promise<WordPressMedia>;
    createPost(postData: WordPressPostData): Promise<WordPressPost>;
    testConnection(): Promise<boolean>;
    getCategories(): Promise<WordPressCategory[]>;
    getTags(): Promise<WordPressTag[]>;
}
export declare const wordpressAPI: WordPressAPI;
export default wordpressAPI;
//# sourceMappingURL=wordpressAPI.d.ts.map