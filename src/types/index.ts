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
  url_private_download?: string;
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
    client_msg_id?: string;
  };
}

export interface SlackResponsePayload {
  text?: string;
  attachments?: SlackResponseAttachment[];
  blocks?: SlackResponseBlock[];
}

export interface SlackResponseAttachment {
  title: string;
  title_link?: string;
  text?: string;
  color?: string;
  fallback?: string;
}

export interface SlackResponseBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  accessory?: {
    type: string;
    text?: {
      type: string;
      text: string;
    };
    url?: string;
  };
}

export interface SlackErrorResponsePayload {
  text: string;
  attachments?: SlackErrorResponseAttachment[];
  blocks?: SlackResponseBlock[];
}

export interface SlackErrorResponseAttachment {
  title: string;
  text: string;
  color: string;
  fallback: string;
  fields?: SlackErrorField[];
}

export interface SlackErrorField {
  title: string;
  value: string;
  short?: boolean;
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
  slackResponseSent?: boolean;
}

// Error Types
export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export enum WordPressErrorType {
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  VALIDATION = 'validation',
  MEDIA_UPLOAD = 'media_upload',
  SERVER_ERROR = 'server_error',
  UNKNOWN = 'unknown'
}

export interface WordPressError extends AppError {
  type: WordPressErrorType;
  endpoint?: string;
  response?: any;
}

// Environment Types
export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  SLACK_WEBHOOK_URL?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_RESPONSE_WEBHOOK_URL?: string;
  WP_URL: string;
  WP_USERNAME: string;
  WP_PASSWORD: string;
  DEFAULT_POST_STATUS: string;
  DEFAULT_CATEGORY_ID?: string;
  DEFAULT_TAG_IDS?: string;
  MAX_RETRIES: number;
  RETRY_DELAY: number;
  LOG_LEVEL?: string;
  MONGODB_URI?: string;
  DB_NAME?: string;
}

// Logger Types
export interface LogInfo {
  message: string;
  timestamp?: string;
  level?: string;
  metadata?: any;
}

// Platform Types
export enum Platform {
  WORDPRESS = 'wordpress',
  FACEBOOK = 'facebook',
  ALL = 'all'
}

export interface PlatformResult {
  platform: Platform;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface MultiPlatformResult extends ProcessingResult {
  platforms: PlatformResult[];
}

// Extended Slack Types for Platform Selection
export interface SlackWebhookPayloadExtended extends SlackWebhookPayload {
  platform?: Platform;
  isPlatformSelection?: boolean;
  selectedPlatform?: Platform;
}

export interface SlackInteractivePayload {
  type: string;
  user: {
    id: string;
    username: string;
  };
  channel: {
    id: string;
  };
  actions: Array<{
    action_id: string;
    block_id: string;
    value: string;
  }>;
  response_url: string;
}

// Platform Configuration Types
export interface PlatformConfig {
  wordpress?: {
    url: string;
    username: string;
    password: string;
    defaultCategoryId?: number;
    defaultTagIds?: number[];
    defaultPostStatus?: string;
  };
  facebook?: {
    pageId?: string;
    accessToken?: string;
    pageAccessToken?: string;
  };
}

// Pending Selection State (for in-memory storage)
export interface PendingSelection {
  userId: string;
  channelId: string;
  originalMessage: SlackWebhookPayload;
  timestamp: number;
  expiresAt: number;
}
