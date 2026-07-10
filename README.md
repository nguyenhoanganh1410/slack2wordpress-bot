# Slack to WordPress Auto-Poster (TypeScript)

A Node.js backend application written in TypeScript that automatically posts Slack messages and images to WordPress sites using REST APIs.

## Features

- 📥 Receive Slack messages via Incoming Webhook or Events API
- 🖼️ Download images from Slack (including private URLs)
- 📤 Upload images to WordPress Media Library
- 📝 Create WordPress posts with embedded images
- 🎯 Set featured images automatically
- 🔄 Auto-retry on failures
- 📊 Comprehensive logging
- 🚀 Production-ready with environment variables
- 🔒 TypeScript for type safety and better development experience

## Project Structure

```
slack-to-wordpress/
├── src/
│   ├── controllers/
│   │   └── slackController.ts     # Slack webhook and event handlers
│   ├── middleware/
│   │   └── errorHandler.ts        # Global error handling
│   ├── utils/
│   │   ├── logger.ts             # Winston logging configuration
│   │   ├── wordpressAPI.ts       # WordPress REST API client
│   │   └── imageDownloader.ts    # Image download and processing
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   └── server.ts                 # Main Express server
├── dist/                         # Compiled JavaScript (auto-generated)
├── logs/                         # Log files (auto-created)
├── temp/                         # Temporary image files (auto-created)
├── scripts/
│   ├── setup.sh                  # Automated setup script
│   └── deploy.sh                 # Production deployment script
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore file
├── Dockerfile                   # Docker configuration
├── docker-compose.yml           # Docker Compose setup
├── ecosystem.config.js          # PM2 configuration
├── tsconfig.json               # TypeScript configuration
├── nodemon.json                # Nodemon configuration
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

## Quick Start

### 1. Prerequisites

- Node.js 18+ 
- WordPress site with REST API enabled
- Slack workspace with admin access

### 2. Installation

```bash
# Clone or download the project
cd slack-to-wordpress

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3. Configuration

Edit `.env` file with your credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Slack Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_BOT_TOKEN=xoxb-your-bot-token

# WordPress Configuration
WP_URL=https://your-wordpress-site.com
WP_USERNAME=your-username
WP_PASSWORD=your-application-password

# Optional: Default post settings
DEFAULT_POST_STATUS=publish
DEFAULT_CATEGORY_ID=1
DEFAULT_TAG_IDS=1,2,3

# Retry Configuration
MAX_RETRIES_KEY=1
RETRY_DELAY=1000
```

### 4. Run the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run build && npm start
```

The server will start on `http://localhost:3000`

## TypeScript Development

### Build Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Build with watch mode
npm run build:watch

# Clean build directory
npm run clean
```

### Type Safety

The project includes comprehensive TypeScript types for:
- Slack API responses
- WordPress API requests/responses
- Internal data structures
- Error handling

## Setup Instructions

### Slack Setup

#### Option 1: Incoming Webhook (Recommended)

1. Go to [Slack API](https://api.slack.com/apps)
2. Create a new app or use existing one
3. Enable "Incoming Webhooks"
4. Add a new webhook to your desired channel
5. Copy the webhook URL to your `.env` file as `SLACK_WEBHOOK_URL`

#### Option 2: Events API

1. Create a Slack app with "Event Subscriptions"
2. Subscribe to `message.channels` and/or `message.groups` events
3. Add "Bot Token Scopes": `channels:history`, `groups:history`, `files:read`
4. Install the app and copy the Bot User OAuth Token to `.env` as `SLACK_BOT_TOKEN`
5. Set the Request URL to `https://your-domain.com/events/slack`

### WordPress Setup

#### Generate Application Password

1. Log in to your WordPress admin dashboard
2. Go to **Users → Profile**
3. Scroll down to **Application Passwords**
4. Enter a name (e.g., "Slack Bot")
5. Click **Add New Application Password**
6. Copy the generated password (format: `xxxx xxxx xxxx xxxx xxxx xxxx`)
7. Use this password in your `.env` file as `WP_PASSWORD`

#### Enable REST API

WordPress REST API is enabled by default. Verify by visiting:
`https://your-site.com/wp-json/wp/v2/`

#### Find Category/Tag IDs

1. Go to **Posts → Categories** or **Posts → Tags**
2. Edit a category/tag to see its ID in the URL
3. Add IDs to `.env` as `DEFAULT_CATEGORY_ID` and `DEFAULT_TAG_IDS`

## API Endpoints

### Health Check
```
GET /health
```

### Slack Webhook
```
POST /webhook/slack
```

### Slack Events API
```
POST /events/slack
```

## Deployment

### Local Development

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

### Production Deployment (VPS)

1. **Install Node.js 18+**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Clone and Setup**:
```bash
git clone <your-repo-url>
cd slack-to-wordpress
npm install --production
cp .env.example .env
# Edit .env with production values
```

3. **Build TypeScript**:
```bash
npm run build
```

4. **Install PM2 for Process Management**:
```bash
npm install -g pm2
```

5. **Start with PM2**:
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

6. **Setup Reverse Proxy (Nginx)**:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker Deployment

Build and run:
```bash
docker build -t slack-to-wordpress .
docker run -d -p 3000:3000 --env-file .env slack-to-wordpress
```

Or with Docker Compose:
```bash
docker-compose up -d
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (development/production) |
| `SLACK_WEBHOOK_URL` | Yes* | Slack Incoming Webhook URL |
| `SLACK_BOT_TOKEN` | Yes* | Slack Bot Token |
| `WP_URL` | Yes | WordPress site URL |
| `WP_USERNAME` | Yes | WordPress username |
| `WP_PASSWORD` | Yes | WordPress Application Password |
| `DEFAULT_POST_STATUS` | No | Post status (publish/draft) |
| `DEFAULT_CATEGORY_ID` | No | Default category ID |
| `DEFAULT_TAG_IDS` | No | Comma-separated tag IDs |
| `MAX_RETRIES_KEY` | No | Max retry attempts (default: 3) |
| `RETRY_DELAY` | No | Retry delay in ms (default: 1000) |

*Either webhook URL or bot token is required

## Logging

The application uses Winston for structured logging:

- **Console**: Development environment with colors
- **Files**: Production environment
  - `logs/combined.log` - All logs
  - `logs/error.log` - Error logs only
- **Log rotation**: 5MB max size, 5 files retained

## Error Handling

- Global error handling middleware
- Automatic retry with exponential backoff
- Comprehensive error logging
- Graceful degradation for failed image uploads
- TypeScript type checking for compile-time error prevention

## TypeScript Benefits

- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: Autocomplete and refactoring
- **Self-Documenting Code**: Types serve as documentation
- **Easier Maintenance**: Clear interfaces and contracts
- **Better Team Collaboration**: Shared type definitions

## Security Considerations

- Use HTTPS in production
- Store credentials in environment variables
- Validate webhook signatures (optional enhancement)
- Rate limiting considerations
- File upload size limits
- TypeScript helps prevent runtime type errors

## Troubleshooting

### Common Issues

1. **TypeScript Compilation Errors**
   - Run `npm run build` to check for compilation issues
   - Ensure all dependencies are installed
   - Check tsconfig.json configuration

2. **WordPress 401 Unauthorized**
   - Check Application Password
   - Verify username
   - Ensure REST API is enabled

3. **Slack URL Private Access**
   - Ensure bot token has `files:read` scope
   - Check token is valid and not expired

4. **Image Upload Fails**
   - Check WordPress upload limits
   - Verify image format support
   - Check available disk space

5. **Memory Issues**
   - Monitor large image downloads
   - Implement image size limits
   - Consider streaming for large files

### Debug Mode

Set `NODE_ENV=development` and check:
- Console output
- Log files in `logs/` directory
- Network requests with tools like Postman
- TypeScript compilation output

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with TypeScript
4. Add types for new interfaces
5. Run `npm run build` to check compilation
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section
- Review log files
- Create an issue in the repository
- Verify TypeScript compilation with `npm run build`
