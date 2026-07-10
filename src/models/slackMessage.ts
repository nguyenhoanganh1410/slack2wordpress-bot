import mongoose, { Schema, Document } from 'mongoose';

// Slack Message Interface
export interface ISlackMessage extends Document {
  clientMsgId: string; // Unique client message ID from Slack
  text: string;
  channel: string;
  timestamp: string;
  userId: string; // Slack user ID who sent the message
  status: boolean;
  isPostedToWordPress: boolean;
  isPostedToFacebook: boolean;
  files: string[]; // Array of file URLs (url_private)
  createdAt: Date;
  updatedAt: Date;
}

// Slack Message Schema
export const SlackMessageSchema = new Schema<ISlackMessage>({
  clientMsgId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  text: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  isPostedToFacebook: {
    type: Boolean,
    required: true,
    default: false
  },
  isPostedToWordPress: {
    type: Boolean,
    required: true,
    default: false
  },
  channel: {
    type: String,
    required: true
  },
  status: {
    type: Boolean,
    required: true,
    default: false
  },
  timestamp: {
    type: String,
    required: true
  },
  files: [{
    type: String,
    required: true
  }]
}, {
  timestamps: true,
  collection: 'slack_messages'
});

// Export the model
export const SlackMessage = mongoose.model<ISlackMessage>('SlackMessage', SlackMessageSchema);
