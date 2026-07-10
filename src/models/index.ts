import mongoose, { Schema, Document } from 'mongoose';
import { SlackMessage } from './slackMessage';

// Platform enum
export enum Platform {
  WORDPRESS = 'wordpress',
  FACEBOOK = 'facebook'
}

// Post Mapping Interface
export interface IPostMapping extends Document {
  slackMessageId: string; // Unique Slack message identifier (channel + timestamp)
  platform: Platform;
  postId: string; // Platform-specific post ID
  postUrl: string; // Platform-specific post URL
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    title?: string;
    imagesCount?: number;
    userId?: string;
    channelId?: string;
  };
}

// User Preferences Interface
export interface IUserPreferences extends Document {
  userId: string; // Slack user ID
  channelId?: string; // Slack channel ID (optional, for channel-specific preferences)
  defaultPlatform: Platform;
  lastUsedPlatform: Platform;
  createdAt: Date;
  updatedAt: Date;
  settings?: {
    wordpress?: {
      categoryId?: number;
      tagIds?: number[];
      postStatus?: string;
    };
    facebook?: {
      pageId?: string;
      accessToken?: string; // Encrypted
    };
  };
}

// Post Mapping Schema
const PostMappingSchema = new Schema<IPostMapping>({
  slackMessageId: {
    type: String,
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: Object.values(Platform),
    required: true
  },
  postId: {
    type: String,
    required: true
  },
  postUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending'
  },
  errorMessage: {
    type: String
  },
  metadata: {
    title: String,
    imagesCount: Number,
    userId: String,
    channelId: String
  }
}, {
  timestamps: true,
  collection: 'post_mappings'
});

// Compound index for efficient queries
PostMappingSchema.index({ slackMessageId: 1, platform: 1 }, { unique: true });

// User Preferences Schema
const UserPreferencesSchema = new Schema<IUserPreferences>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  channelId: {
    type: String,
    index: true
  },
  defaultPlatform: {
    type: String,
    enum: Object.values(Platform),
    default: Platform.WORDPRESS
  },
  lastUsedPlatform: {
    type: String,
    enum: Object.values(Platform),
    default: Platform.WORDPRESS
  },
  settings: {
    wordpress: {
      categoryId: Number,
      tagIds: [Number],
      postStatus: {
        type: String,
        default: 'draft'
      }
    },
    facebook: {
      pageId: String,
      accessToken: String // Should be encrypted in production
    }
  }
}, {
  timestamps: true,
  collection: 'user_preferences'
});

// Compound index for user + channel preferences
UserPreferencesSchema.index({ userId: 1, channelId: 1 }, { unique: true });


// Models
export const PostMapping = mongoose.model<IPostMapping>('PostMapping', PostMappingSchema);
export const UserPreferences = mongoose.model<IUserPreferences>('UserPreferences', UserPreferencesSchema);
export { SlackMessage };