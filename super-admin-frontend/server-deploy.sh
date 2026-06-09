#!/usr/bin/env bash
#
# server-deploy.sh — Pull, build, and reload the app on the EC2 instance.
#
# Run this ON the server (not from your laptop). Typical invocation:
#   ssh ubuntu@<host> 'bash /home/ubuntu/whitepenguin/server-deploy.sh'
#
# Optional first arg: branch name (defaults to "development").
#   bash server-deploy.sh main
#
# Requirements on the server:
#   - nvm installed at $HOME/.nvm with Node 22 as default
#       nvm install 22 && nvm alias default 22
#   - Repo cloned to /home/ubuntu/whitepenguin
#   - .env.production present at the repo root (NEVER commit it)
#   - PM2 installed globally
#

set -eo pipefail
# NOTE: deliberately not enabling `set -u` here because nvm.sh references
# unset internals (e.g. $VERSION) which break under strict mode.

APP_DIR="/home/ubuntu/whitepenguin"
BRANCH="${1:-development}"
LOCKFILE="/tmp/whitepenguin-deploy.lock"
LOGFILE="/tmp/whitepenguin-deploy-$(date +%Y%m%d-%H%M%S).log"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

# ---------- 0. Single-run lock ----------
exec 200>"$LOCKFILE"
flock -n 200 || fail "Another deploy is already running. Lock: $LOCKFILE"

# ---------- 1. Sanity checks ----------
log "Starting deploy of branch '$BRANCH' to $APP_DIR (log: $LOGFILE)"

[ -d "$APP_DIR" ] || fail "$APP_DIR does not exist. Clone the repo first."
cd "$APP_DIR"

[ -f .env.production ] || fail ".env.production missing in $APP_DIR. Create it before deploying."

# ---------- 2. Load nvm (strict mode off, then back on) ----------
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] || fail "nvm not found at $NVM_DIR/nvm.sh"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

nvm use default >/dev/null 2>&1 || nvm use 22 >/dev/null 2>&1 || fail "Could not select a Node version via nvm."
log "Using node $(node -v) / npm $(npm -v)"

# ---------- 3. Pull latest code ----------
log "Fetching origin..."
git fetch --all --prune

# Reset hard discards any local changes on the server (intended for prod boxes).
log "Resetting to origin/$BRANCH..."
git reset --hard "origin/$BRANCH"

# ---------- 4. Install dependencies ----------
log "Installing dependencies (npm ci)..."
npm ci --legacy-peer-deps

# ---------- 5. Build ----------
log "Building Next.js (NODE_ENV=production)..."
# Export so the prebuild hook (scripts/generate-firebase-sw.js) picks the right .env file.
# next build itself also sets NODE_ENV=production internally.
export NODE_ENV=production
npm run build

# ---------- 6. Verify build output ----------
if [ ! -f .next/BUILD_ID ]; then
  fail "Build finished but .next/BUILD_ID is missing. Aborting before touching PM2."
fi
log "Build OK ($(cat .next/BUILD_ID))"

# ---------- 7. Reload PM2 (zero-downtime) ----------
log "Reloading PM2..."
# `reload` does graceful zero-downtime restart if the app is already running,
# and `startOrReload` falls back to start if it isn't.
pm2 startOrReload ecosystem.config.js --env production --update-env

pm2 save >/dev/null
log "PM2 status:"
pm2 status

log "Deploy complete."
