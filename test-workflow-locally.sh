#!/bin/bash
# Local workflow testing script
# Usage: ./test-workflow-locally.sh [step]
# Steps: script, all

set -e

# Load environment variables (create .env file with your secrets)
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  No .env file found. Create one with your secrets:"
    echo "REDIS_URL=redis://localhost:6379"
    echo "GEMINI_API_KEY_1=..."
    echo "GEMINI_API_KEY_2=..."
    echo "CLOUDINARY_CLOUD_NAME=..."
    echo "CLOUDINARY_API_KEY=..."
    echo "CLOUDINARY_API_SECRET=..."
    echo "YT_CLIENT_ID=..."
    echo "YT_CLIENT_SECRET=..."
    echo "YT_REFRESH_TOKEN=..."
    echo "WEBSITE_DOMAIN=https://your-domain.com"
    exit 1
fi

# Build all projects first
echo "📦 Building all workspaces..."
npm run build

STEP=${1:-script}

case $STEP in
    script)
        echo "📝 Testing script generation (pops idea from Redis queue)..."
        cd .github/scripts
        npx tsx generate-script.ts
        cd ../..
        ;;
    
    all)
        echo "🚀 Testing complete pipeline..."
        echo ""
        echo "For full pipeline testing with parallel execution:"
        echo "1. Push code to GitHub"
        echo "2. Configure GitHub Secrets"
        echo "3. Go to Actions → Daily Video Generation Pipeline → Run workflow"
        echo ""
        echo "Running script generation test locally..."
        cd .github/scripts
        npx tsx generate-script.ts
        cd ../..
        ;;
    
    *)
        echo "❌ Unknown step: $STEP"
        echo ""
        echo "Available options:"
        echo "  script  - Test script generation (pops from Redis, generates full script)"
        echo "  all     - Show instructions for full pipeline testing"
        echo ""
        echo "Note: Individual steps (scenes, voiceover, etc.) are designed to run"
        echo "      in GitHub Actions with proper job dependencies and artifacts."
        echo "      Use GitHub Actions manual trigger for complete pipeline testing."
        exit 1
        ;;
esac

echo ""
echo "✅ Test completed successfully!"
