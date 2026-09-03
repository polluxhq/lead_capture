# Pollux Lead Capture API

A tiny Node.js/Express API with two dummy endpoints for lead capture.

## Endpoints

### `POST /v1/dummy/leads`

Accepts a JSON body with `api_token` and stores a lead in MySQL (`id`, `api_token`, `status`, `ftd_date`, `created_at`). `status` is picked at random from `new`, `pending`, `registered`, `rejected`, or `duplicate`. `ftd_date` is always `null`.

Returns a created lead response:

```json
{
  "id": 1,
  "message": "Created successfully",
  "auto_login_url": "https://your-domain.com/1"
}
```

- `id` is the MySQL auto-increment integer for the stored lead.
- `message` is always `"Created successfully"`.
- `auto_login_url` is built from the configured `APP_URL` plus the lead `id`.

### `GET /v1/dummy/leads`

Query parameters:

- `api_token` (required) — returns only leads stored with this token
- `per_page` (optional) — max number of records to return. Defaults to the last **1000**
- `start_date` / `end_date` (optional) — filter by `created_at` (inclusive). Date-only values like `2026-09-01` cover the full day

```bash
curl "http://localhost:3000/v1/dummy/leads?api_token=your-token"
curl "http://localhost:3000/v1/dummy/leads?api_token=your-token&per_page=10&start_date=2026-09-01&end_date=2026-09-03"
```

Returns an array of matching leads, newest first:

```json
[
  {
    "id": 1,
    "api_token": "your-token",
    "status": "pending",
    "ftd_date": null,
    "created_at": "2026-09-03T07:21:00.000Z"
  }
]
```

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and adjust it. Point the `DB_*` variables at a MySQL server (the app creates the database and `leads` table on startup):

   ```bash
   cp .env.example .env
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Test the endpoints:

   ```bash
   curl -X POST http://localhost:3000/v1/dummy/leads \
     -H "Content-Type: application/json" \
     -d '{"api_token":"your-token"}'
   curl "http://localhost:3000/v1/dummy/leads?api_token=your-token"
   ```

## Hosting on AWS with Laravel Forge

Laravel Forge can provision and manage an AWS server for you. This project is configured to run with **PM2** behind **Nginx**.

### 1. Push the project to a Git repository

Laravel Forge deploys from a Git repository. If this project is not already on GitHub/GitLab/Bitbucket, create a new repo and push it:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/pollux-lead-capture.git
git push -u origin main
```

### 2. Create an AWS server in Forge

1. Log in to [Laravel Forge](https://forge.laravel.com).
2. Choose **Servers** → **Create Server**.
3. Select **AWS** as the provider.
4. Add your AWS credentials (or select an existing linked AWS account).
   - You can find/create these in the AWS IAM console under **Users** → **Security credentials** → **Access keys**.
5. Pick a region, server size, and operating system (Ubuntu 22.04 LTS or 24.04 LTS recommended).
6. Forge will create the EC2 instance, security group, and provision it automatically. This usually takes a few minutes.

### 3. Create a site in Forge

1. Once the server is ready, click **Add Site**.
2. Enter your domain name (e.g., `api.yourdomain.com`).
   - For the example response below, replace `APP_URL` with this domain.
3. Under **Project Type**, choose **Static HTML / Nginx** (we will override the Nginx config to proxy to Node.js).
4. Connect the Git repository (`pollux-lead-capture`) and branch (`main`).
5. Forge will clone the project onto the server.

### 4. Configure the environment

1. In the Forge site, go to the **Environment** tab.
2. Add the following variables:

   ```
   PORT=3000
   APP_URL=https://api.yourdomain.com
   NODE_ENV=production
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=pollux_lead_capture
   DB_USERNAME=forge
   DB_PASSWORD=your-mysql-password
   ```

   Replace `api.yourdomain.com` with your actual domain. Do **not** include a trailing slash.
3. Save the environment file.

### 5. Update the Nginx configuration

1. In the site, go to the **Nginx** tab → **Edit Configuration**.
2. Replace the entire contents with the configuration in `forge/nginx.conf`:

   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_cache_bypass $http_upgrade;
   }
   ```

3. Save the file and reload Nginx.

### 6. Configure the deployment script

1. In the site, go to the **Deployment** tab.
2. Replace the default script with the contents of `forge/deploy.sh`:

   ```bash
   #!/bin/bash
   set -e

   cd /home/forge/api.yourdomain.com

   npm ci --production

   if pm2 describe pollux-lead-capture >/dev/null 2>&1; then
       pm2 restart pollux-lead-capture
   else
       pm2 start ecosystem.config.js --env production
   fi

   pm2 save

   echo "Deployment complete."
   ```

   Make sure `api.yourdomain.com` matches the site path Forge created (usually `/home/forge/your-domain.com`).

3. Save the deployment script.

### 7. Deploy

1. Click **Deploy Now** in Forge.
2. Forge will run the deployment script, install dependencies, and start/restart the PM2 process.
3. Check the **Monitoring** tab or SSH into the server and run `pm2 logs pollux-lead-capture` to confirm the app is running.

### 8. DNS / HTTPS

1. Point your domain's DNS A record to the AWS server's public IP address.
2. In Forge, go to the **SSL** tab and install a free **Let's Encrypt** certificate for HTTPS.
3. Once DNS propagates and SSL is installed, test:

   ```bash
   curl -X POST https://api.yourdomain.com/v1/dummy/leads \
     -H "Content-Type: application/json" \
     -d '{"api_token":"your-token"}'
   curl "https://api.yourdomain.com/v1/dummy/leads?api_token=your-token"
   ```

### Useful server commands

If you ever need to manage the process manually via SSH:

```bash
pm2 status
pm2 logs pollux-lead-capture
pm2 restart pollux-lead-capture
pm2 stop pollux-lead-capture
```

## Project structure

```
.
├── .env.example
├── .gitignore
├── ecosystem.config.js       # PM2 process configuration
├── forge/
│   ├── deploy.sh              # Forge deployment script
│   └── nginx.conf             # Nginx reverse proxy config
├── db.js                      # MySQL connection and lead inserts
├── index.js                   # Express server
├── package.json
└── README.md
```
