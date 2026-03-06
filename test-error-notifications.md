# WordPress Error Notifications Test Guide

This document explains how to test the new WordPress error notification functionality.

## Features Implemented

### 1. Error Categorization
- **Authentication Errors** (🔐): Invalid WordPress credentials
- **Network Errors** (🌐): Connection timeouts, unreachable WordPress site
- **Validation Errors** (⚠️): Invalid post data, missing required fields
- **Media Upload Errors** (🖼️): Image upload failures, file size issues
- **Server Errors** (🔥): WordPress server errors

### 2. Slack Error Notifications
- User-friendly Vietnamese error messages
- Error type indicators with appropriate emojis
- Actionable suggestions for common issues
- Retry attempt information
- Timestamps for debugging
- Optional user mentions for critical errors

### 3. Enhanced Error Handling
- Detailed error categorization in WordPress API
- Partial success tracking for image uploads
- Comprehensive error logging
- Graceful fallback handling

## Testing Scenarios

### 1. Authentication Error Test
**Setup**: Set incorrect WordPress credentials in environment variables
**Expected**: 🔐 Lỗi xác thực WordPress message with credential checking suggestion

### 2. Network Error Test
**Setup**: Set incorrect WP_URL or disable network connection
**Expected**: 🌐 Lỗi kết nối WordPress message with network checking suggestion

### 3. Validation Error Test
**Setup**: Send message with invalid content that WordPress rejects
**Expected**: ⚠️ Lỗi dữ liệu message with content validation suggestion

### 4. Media Upload Error Test
**Setup**: Send large image file or unsupported format
**Expected**: 🖼️ Lỗi tải ảnh lên message with file size/format suggestion

### 5. Server Error Test
**Setup**: Temporarily disable WordPress server or return 500 error
**Expected**: 🔥 Lỗi máy chủ WordPress message with retry suggestion

## Environment Variables for Error Notifications

### Optional Configuration
```bash
# User to mention for critical errors (excluding validation errors)
SLACK_ERROR_MENTION_USER=U1234567890

# Enable detailed error information in Slack messages
ENABLE_DETAILED_ERRORS=true

# Specific channel for error notifications (falls back to response webhook)
SLACK_ERROR_CHANNEL=C1234567890
```

## Error Message Format

### Basic Error Notification
```
❌ Lỗi đăng bài WordPress: [Error message]

**Lỗi đăng bài WordPress**
[Detailed error message]

💡 *Gợi ý:* [Actionable suggestion]

**Fields:**
- Lần thử: 2/3
- Thời gian: 06/03/2026, 12:52:00
- Ảnh đã tải lên: 2/3 (if applicable)
```

### Development Mode Error (Additional Details)
```
❌ Lỗi đăng bài WordPress: [Error message]

**Lỗi đăng bài WordPress**
[Detailed error message]

💡 *Gợi ý:* [Actionable suggestion]

**Fields:**
- Lần thử: 2/3
- Thời gian: 06/03/2026, 12:52:00
- Ảnh đã tải lên: 2/3
- Chi tiết lỗi: `/wp-json/wp/v2/posts` `401`
```

## Code Changes Summary

### Files Modified
1. **src/types/index.ts** - Added error notification types and enums
2. **src/utils/wordpressAPI.ts** - Enhanced error categorization and handling
3. **src/controllers/slackController.ts** - Added error notification methods

### Key Methods Added
- `sendSlackErrorResponse()` - Sends formatted error notifications to Slack
- `categorizeError()` - Categorizes WordPress API errors by type
- Enhanced `processImages()` - Better error tracking for image uploads

## Testing Checklist

- [ ] Authentication errors show 🔐 and credential suggestions
- [ ] Network errors show 🌐 and network checking suggestions
- [ ] Validation errors show ⚠️ and content validation suggestions
- [ ] Media upload errors show 🖼️ and file format suggestions
- [ ] Server errors show 🔥 and retry suggestions
- [ ] Error messages include retry attempt information
- [ ] Error messages include timestamps
- [ ] Partial success information displays correctly
- [ ] Error notifications work for both webhook and event handlers
- [ ] Optional environment variables work as expected
- [ ] Build completes successfully without TypeScript errors

## Benefits

1. **Better User Experience**: Users get immediate feedback about what went wrong
2. **Faster Debugging**: Clear error categorization helps identify issues quickly
3. **Actionable Guidance**: Specific suggestions help users resolve common problems
4. **Retry Transparency**: Users can see how many attempts were made
5. **Partial Success Tracking**: Users know if some images succeeded even if post failed
6. **Vietnamese Localization**: All error messages are in Vietnamese for better usability
