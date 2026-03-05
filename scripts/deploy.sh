#!/bin/bash

# Slack to WordPress Deployment Script
# This script helps deploy the application to production

set -e

echo "🚀 Slack to WordPress Deployment Script"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="slack-to-wordpress"
APP_DIR="/opt/$APP_NAME"
SERVICE_NAME=$APP_NAME
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Install system dependencies
install_system_deps() {
    echo "📦 Installing system dependencies..."
    
    # Update package list
    apt update
    
    # Install Node.js 18
    if ! command -v node &> /dev/null; then
        print_info "Installing Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    else
        print_success "Node.js is already installed"
    fi
    
    # Install PM2
    if ! command -v pm2 &> /dev/null; then
        print_info "Installing PM2..."
        npm install -g pm2
    else
        print_success "PM2 is already installed"
    fi
    
    # Install Nginx
    if ! command -v nginx &> /dev/null; then
        print_info "Installing Nginx..."
        apt-get install -y nginx
    else
        print_success "Nginx is already installed"
    fi
    
    print_success "System dependencies installed"
}

# Create application directory
create_app_dir() {
    echo "📁 Creating application directory..."
    
    mkdir -p $APP_DIR
    cd $APP_DIR
    
    print_success "Application directory created: $APP_DIR"
}

# Deploy application files
deploy_app() {
    echo "🚚 Deploying application files..."
    
    # Copy files from current directory to app directory
    if [ -d "slack-to-wordpress" ]; then
        cp -r slack-to-wordpress/* .
    else
        print_error "Source directory not found"
        exit 1
    fi
    
    # Install dependencies
    npm ci --production
    
    # Create necessary directories
    mkdir -p logs temp
    
    # Set permissions
    chown -R www-data:www-data $APP_DIR
    chmod -R 755 $APP_DIR
    
    print_success "Application files deployed"
}

# Setup PM2
setup_pm2() {
    echo "⚙️  Setting up PM2..."
    
    cd $APP_DIR
    
    # Start application with PM2
    pm2 start ecosystem.config.js --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup
    
    print_success "PM2 setup completed"
}

# Setup Nginx reverse proxy
setup_nginx() {
    echo "🌐 Setting up Nginx reverse proxy..."
    
    # Read domain from user
    read -p "Enter your domain name (e.g., example.com): " DOMAIN
    
    if [ -z "$DOMAIN" ]; then
        print_warning "No domain provided, skipping Nginx setup"
        return
    fi
    
    # Create Nginx configuration
    cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Redirect to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL configuration (will be updated by Certbot)
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Log files
    access_log /var/log/nginx/$APP_NAME-access.log;
    error_log /var/log/nginx/$APP_NAME-error.log;
}
EOF
    
    # Enable site
    ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    nginx -t
    
    # Restart Nginx
    systemctl restart nginx
    
    print_success "Nginx configuration completed"
    
    # Ask about SSL certificate
    read -p "Do you want to install SSL certificate with Certbot? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_ssl $DOMAIN
    fi
}

# Install SSL certificate with Certbot
install_ssl() {
    local DOMAIN=$1
    
    echo "🔒 Installing SSL certificate for $DOMAIN..."
    
    # Install Certbot
    if ! command -v certbot &> /dev/null; then
        apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Get SSL certificate
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    
    # Setup auto-renewal
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
    
    print_success "SSL certificate installed and auto-renewal configured"
}

# Setup firewall
setup_firewall() {
    echo "🔥 Setting up firewall..."
    
    # Allow SSH, HTTP, and HTTPS
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Enable firewall
    ufw --force enable
    
    print_success "Firewall configured"
}

# Display deployment summary
show_summary() {
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "=================================="
    echo ""
    echo "📍 Application directory: $APP_DIR"
    echo "🌐 Web server: Nginx"
    echo "⚙️  Process manager: PM2"
    echo "🔥 Firewall: UFW"
    echo ""
    echo "🔗 Useful commands:"
    echo "   Check app status: pm2 status"
    echo "   View logs: pm2 logs $APP_NAME"
    echo "   Restart app: pm2 restart $APP_NAME"
    echo "   Nginx reload: systemctl reload nginx"
    echo ""
    echo "📝 Don't forget to:"
    echo "   1. Edit $APP_DIR/.env with your credentials"
    echo "   2. Restart the app: pm2 restart $APP_NAME"
    echo "   3. Configure your Slack webhook to point to your domain"
    echo ""
    echo "📚 For more information, see README.md"
}

# Main execution
main() {
    echo "Starting deployment process..."
    echo ""
    
    check_root
    install_system_deps
    create_app_dir
    deploy_app
    setup_pm2
    setup_nginx
    setup_firewall
    show_summary
}

# Run main function
main "$@"
