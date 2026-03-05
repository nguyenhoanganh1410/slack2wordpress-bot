import { SlackMessage, DownloadedImage } from '@/types';
declare class ImageDownloader {
    private slackToken;
    private tempDir;
    constructor();
    downloadImage(imageUrl: string, filename?: string): Promise<DownloadedImage>;
    downloadMultipleImages(imageUrls: string[]): Promise<DownloadedImage[]>;
    saveToTemp(buffer: Buffer, filename: string): Promise<string>;
    cleanupTempFiles(filePaths: string[]): Promise<void>;
    extractImageUrls(slackMessage: SlackMessage): string[];
    validateImageBuffer(buffer: Buffer): boolean;
}
export declare const imageDownloader: ImageDownloader;
export default imageDownloader;
//# sourceMappingURL=imageDownloader.d.ts.map