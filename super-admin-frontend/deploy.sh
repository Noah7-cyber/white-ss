#!/bin/bash

echo "🚀 Starting deployment..."

# ===== CONFIG =====
EC2_HOST="13.49.158.73"
EC2_USER="ubuntu"
KEY_PATH="$HOME/Development/Certs/devs_key_pair.pem"
REMOTE_PATH="/home/ubuntu/whitepenguin"

# ===== 1. Validate env file =====
ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE not found. Copy .env.example to $ENV_FILE and fill in production values."
  exit 1
fi

# ===== 2. Install (only if needed) =====
echo "📦 Installing dependencies..."
npm ci --legacy-peer-deps

# ===== 3. Build =====
echo "🏗 Building Next.js app..."
# Export every var from .env.production so both Next.js and our SW generator see them.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
npm run build

# ===== 4. Upload (FAST - incremental) =====
echo "📤 Syncing files to EC2 (only changes)..."

rsync -avz --delete \
--exclude=".next/cache" \
-e "ssh -i $KEY_PATH -o StrictHostKeyChecking=no" \
.next \
public \
package.json \
ecosystem.config.js \
$EC2_USER@$EC2_HOST:$REMOTE_PATH

# ===== 5. Restart app =====
echo "🔁 Restarting app on EC2..."

ssh -o StrictHostKeyChecking=no -i $KEY_PATH $EC2_USER@$EC2_HOST << 'EOF'

  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  cd /home/ubuntu/whitepenguin

  echo "📦 Installing deps only if needed..."
  npm install --legacy-peer-deps

  echo "🚀 Reloading PM2..."
  pm2 reload white-penguin
  
  echo "📋 PM2 status:"
  pm2 status

EOF

echo "✅ Deployment complete!"