#!/bin/bash

# Slack to WordPress Setup Script (TypeScript)
# This script helps set up the TypeScript project for development and production

set -e

echo "🚀 Slack to WordPress TypeScript Setup Script"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Check if Node.js is installed
check_nodejs() {
    echo "📋 Checking Node.js installation..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is installed: $NODE_VERSION"
        
        # Check if version is 18 or higher
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -lt 18 ]; then
            print_error "Node.js version 18 or higher is required. Current version: $NODE_VERSION"
            exit 1
        fi
    else
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    if [ -f "package.json" ]; then
        npm install
        print_success "Dependencies installed successfully"
    else
        print_error "package.json not found"
        exit 1
    fi
}

# Setup environment file
setup_environment() {
    echo "⚙️  Setting up environment..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env file from .env.example"
            print_warning "Please edit .env file with your credentials"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    else
        print_warning ".env file already exists"
    fi
}

# Create necessary directories
create_directories() {
    echo "📁 Creating necessary directories..."
    
    mkdir -p logs temp dist
    print_success "Created logs, temp, and dist directories"
}

# Build TypeScript project
build_project() {
    echo "🔨 Building TypeScript project..."
    
    npm run build
    print_success "TypeScript project built successfully"
}

# Check WordPress connection
check_wordpress() {
    echo "🔍 Testing WordPress connection..."
    
    if [ -f ".env" ]; then
        # Source environment variables (simple approach)
        export $(grep -v '^#' .env | xargs)
        
        if [ -n "$WP_URL" ] && [ -n "$WP_USERNAME" ] && [ -n "$WP_PASSWORD" ]; then
            echo "Testing WordPress API connection..."
            RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -u "$WP_USERNAME:$WP_PASSWORD" "$WP_URL/wp-json/wp/v2/users/me" || echo "000")
            
            if [ "$RESPONSE" = "200" ]; then
                print_success "WordPress connection successful"
            else
                print_error "WordPress connection failed (HTTP $RESPONSE)"
                print_warning "Please check your WordPress credentials in .env"
            fi
        else
            print_warning "WordPress credentials not found in .env"
        fi
    else
        print_warning ".env file not found, skipping WordPress connection test"
    fi
}

# Display next steps
show_next_steps() {
    echo ""
    echo "🎉 TypeScript setup completed!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Edit .env file with your Slack and WordPress credentials"
    echo "2. Run 'npm run dev' for development or 'npm run build && npm start' for production"
    echo "3. Test the webhook endpoint"
    echo ""
    echo "📚 For detailed instructions, see README.md"
    echo ""
    echo "🔗 Useful endpoints:"
    echo "   Health check: http://localhost:3000/health"
    echo "   Slack webhook: http://localhost:3000/webhook/slack"
    echo "   Slack events: http://localhost:3000/events/slack"
    echo ""
    echo "🛠️  Development commands:"
    echo "   npm run dev        - Start development server with hot reload"
    echo "   npm run build      - Build TypeScript to JavaScript"
    echo "   npm run build:watch - Build with watch mode"
    echo "   npm start          - Start production server"
}

# Main execution
main() {
    echo "Starting TypeScript setup process..."
    echo ""
    
    check_nodejs
    install_dependencies
    setup_environment
    create_directories
    build_project
    check_wordpress
    show_next_steps
}

# Run main function
main "$@"
