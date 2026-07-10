#!/usr/bin/env node

/**
 * Database Initialization Script
 * Sets up MongoDB collections and indexes for the Slack to WordPress application
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function initDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/slack-to-wordpress';
    const dbName = process.env.DB_NAME || 'slack-to-wordpress';

    console.log(`Connecting to MongoDB: ${mongoUri}/${dbName}`);

    await mongoose.connect(mongoUri, {
      dbName,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    const db = mongoose.connection.db;

    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    // Post mappings collection
    if (!collectionNames.includes('post_mappings')) {
      console.log('Creating post_mappings collection...');
      await db.createCollection('post_mappings');
    }

    // User preferences collection
    if (!collectionNames.includes('user_preferences')) {
      console.log('Creating user_preferences collection...');
      await db.createCollection('user_preferences');
    }

    // Create indexes
    console.log('Creating indexes...');

    const postMappingsCollection = db.collection('post_mappings');
    await postMappingsCollection.createIndex({ slackMessageId: 1 });
    await postMappingsCollection.createIndex({ slackMessageId: 1, platform: 1 }, { unique: true });
    await postMappingsCollection.createIndex({ createdAt: 1 });
    await postMappingsCollection.createIndex({ status: 1 });

    const userPreferencesCollection = db.collection('user_preferences');
    await userPreferencesCollection.createIndex({ userId: 1 });
    await userPreferencesCollection.createIndex({ channelId: 1 });
    await userPreferencesCollection.createIndex({ userId: 1, channelId: 1 }, { unique: true });

    console.log('Database initialization completed successfully!');

    // Insert sample data for testing (optional)
    if (process.env.NODE_ENV === 'development') {
      console.log('Inserting sample data...');

      // Sample user preferences
      await userPreferencesCollection.insertOne({
        userId: 'sample_user',
        channelId: 'sample_channel',
        defaultPlatform: 'wordpress',
        lastUsedPlatform: 'wordpress',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log('Sample data inserted.');
    }

  } catch (error) {
    console.error('Database initialization failed:', error.message);
    console.error('Please ensure MongoDB is running or set MONGODB_URI to a valid MongoDB connection string');
    console.error('The application can still run without database, but database features will be disabled');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run initialization
initDatabase();