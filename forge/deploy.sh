#!/bin/bash
set -e

cd /home/forge/your-domain.com

# Install dependencies
npm ci --production

# Restart the Node.js process with PM2
if pm2 describe pollux-lead-capture >/dev/null 2>&1; then
    pm2 restart pollux-lead-capture
else
    pm2 start ecosystem.config.js --env production
fi

pm2 save

echo "Deployment complete."
