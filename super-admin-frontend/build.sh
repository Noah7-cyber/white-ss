#!/bin/bash

echo "🚀 Starting deployment..."

# # 1. Install dependencies
# echo "📦 Installing dependencies..."
# npm ci --legacy-peer-deps

# # 2. Build app
# echo "🏗 Building Next.js app..."
# NODE_ENV=production \
# NEXT_PUBLIC_AUTH_APP_SUBDOMAIN=app \
# NEXT_PUBLIC_APP_DOMAIN=whitepenguin.heimdallprodev.com \
# NEXT_PUBLIC_API_URL=https://whitepenguin-api.heimdallprodev.com \
# WEBSOCKET_URL=https://whitepenguin-api.heimdallprodev.com \
# npm run build

# 3. Upload to EC2
echo "📤 Uploading files to EC2..."
scp -i ~/Development/Certs/Ec2_key_pare.pem -r \
.next public package.json ecosystem.config.js \
ubuntu@3.79.191.237:/home/ubuntu/whitepenguin

# 4. Restart app on EC2
echo "🔁 Restarting app..."
ssh -i ~/Development/Certs/Ec2_key_pare.pem ubuntu@3.79.191.237 << 'EOF'
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  cd /home/ubuntu/whitepenguin

  pm2 reload ecosystem.config.js --env production
EOF

echo "✅ Deployment complete!"