// Slack Types
export interface SlackMessage {
  text?: string;
  user?: string;
  channel?: string;
  timestamp?: string;
  files?: SlackFile[];
  attachments?: SlackAttachment[];
  blocks?: SlackBlock[];
}

export interface SlackFile {
  id: string;
  name: string;
  mimetype?: string;
  url_private?: string;
  url?: string;
  title?: string;
}

export interface SlackAttachment {
  text?: string;
  fallback?: string;
  image_url?: string;
  title?: string;
}

export interface SlackBlock {
  type: string;
  image_url?: string;
  alt_text?: string;
}

export interface SlackWebhookPayload {
  text?: string;
  user?: string;
  channel?: string;
  timestamp?: string;
  files?: SlackFile[];
  attachments?: SlackAttachment[];
  blocks?: SlackBlock[];
}

export interface SlackEventPayload {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
    bot_id?: string;
    subtype?: string;
    files?: SlackFile[];
    attachments?: SlackAttachment[];
    blocks?: SlackBlock[];
  };
}

// WordPress Types
export interface WordPressMedia {
  id: number;
  url: string;
  title: string;
  alt_text: string;
}

export interface WordPressPost {
  id: number;
  title: string;
  content: string;
  status: string;
  link: string;
  featured_media: number;
}

export interface WordPressPostData {
  title: string;
  content: string;
  status?: string;
  excerpt?: string;
  featuredMedia?: number;
  categories?: number[];
  tags?: number[];
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WordPressTag {
  id: number;
  name: string;
  slug: string;
}

// Image Processing Types
export interface DownloadedImage {
  buffer: Buffer;
  filename: string;
}

export interface UploadedImage {
  id: number;
  url: string;
  title: string;
  alt_text: string;
}

// API Response Types
export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

// Processing Result Types
export interface ProcessingResult {
  success: boolean;
  postId?: number;
  postUrl?: string;
  imagesUploaded?: number;
  attempt?: number;
  error?: string;
}

// Error Types
export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

// Environment Types
export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  SLACK_WEBHOOK_URL?: string;
  SLACK_BOT_TOKEN?: string;
  WP_URL: string;
  WP_USERNAME: string;
  WP_PASSWORD: string;
  DEFAULT_POST_STATUS: string;
  DEFAULT_CATEGORY_ID?: string;
  DEFAULT_TAG_IDS?: string;
  MAX_RETRIES: number;
  RETRY_DELAY: number;
  LOG_LEVEL?: string;
}

// Logger Types
export interface LogInfo {
  message: string;
  timestamp?: string;
  level?: string;
  metadata?: any;
}
