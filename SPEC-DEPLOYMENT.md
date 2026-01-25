# SPEC-DEPLOYMENT: VPS Deployment Guide

Deployment specification for the AI Interior Design application to a VPS Ubuntu server.

---

## Architecture Overview

```
                                    ┌─────────────────────────────────────┐
                                    │           VPS Ubuntu Server         │
┌──────────┐                        │                                     │
│  Users   │ ──── HTTPS ────────────▶  Nginx (80/443)                    │
└──────────┘                        │       │                             │
                                    │       ├── /        → Next.js :3001  │
                                    │       └── /llm/*   → Python  :5000  │
                                    │                                     │
                                    │  ┌─────────────────────────────┐    │
                                    │  │     Docker Compose          │    │
                                    │  │  ┌─────────┐  ┌──────────┐  │    │
                                    │  │  │ Next.js │──│  Python  │  │    │
                                    │  │  │  :3001  │  │  :5000   │  │    │
                                    │  │  └────┬────┘  └────┬─────┘  │    │
                                    │  │       │            │        │    │
                                    │  │       └────┬───────┘        │    │
                                    │  │            ▼                │    │
                                    │  │     [SQLite Volume]         │    │
                                    │  └─────────────────────────────┘    │
                                    └─────────────────────────────────────┘
```

**Components:**

- **Domain:** `interior.ilutay.com`
- **Next.js** (root) - Frontend + API routes, standalone build, port 3001
- **Python FastAPI** (`LLM/`) - AI analysis endpoints, port 5000
- **Shared SQLite** - Persisted via Docker volume
- **Nginx** - Reverse proxy with SSL termination

---

## Service Details

### Next.js Frontend (Port 3001)

- Framework: Next.js with App Router
- Build mode: **Standalone** (optimized for Docker)
- Handles: UI, authentication, project management, chat interface
- Calls Python backend via Docker network: `http://llm:5000`

### Python LLM Backend (Port 5000)

FastAPI server providing AI-powered analysis endpoints:

| Endpoint             | Method | Description                                   |
| -------------------- | ------ | --------------------------------------------- |
| `/health`            | GET    | Health check                                  |
| `/analyze`           | POST   | Analyze floor plan, returns JSON with rooms   |
| `/analyze/image`     | POST   | Analyze floor plan, returns PNG with overlays |
| `/analyze-furniture` | POST   | Identify furniture in room images             |
| `/search-products`   | POST   | Find where to buy similar furniture           |
| `/analyze-and-shop`  | POST   | Combined: identify + search products          |
| `/visual-search`     | POST   | Visual search via Google Lens                 |

---

## Next.js on VPS: Important Considerations

Running Next.js on a VPS differs from Vercel. Key adjustments needed:

### 1. Standalone Output Mode (Required)

Add to `next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};

export default nextConfig;
```

**Why:** Creates a minimal production build (~100MB vs ~500MB+) that includes only necessary dependencies.

### 2. Image Optimization

Install `sharp` for production image optimization:

```bash
npm install sharp
```

Without `sharp`, Next.js falls back to a slower, less efficient image optimizer.

### 3. Environment Variables

Next.js requires `HOSTNAME=0.0.0.0` to bind correctly in Docker:

```dockerfile
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
```

### 4. Static Assets

Standalone mode requires copying `public/` and `.next/static/` manually in Dockerfile.

### 5. No Edge Runtime

Edge runtime features (middleware with edge runtime) won't work on VPS. Use Node.js runtime for all routes.

### 6. WebSocket Considerations

For real-time features, ensure Nginx is configured for WebSocket upgrades (included in config below).

---

## Docker Setup

### Directory Structure

```
/opt/interior/
├── docker-compose.yml
├── Dockerfile              # Next.js
├── LLM/
│   └── Dockerfile          # Python
├── .env                    # Production secrets (not in git)
└── ... (rest of repo)
```

### Dockerfile (Next.js) - `Dockerfile`

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js with increased memory limit (prevents OOM on low-memory VPS)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
```

### Dockerfile (Python) - `LLM/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd --create-home appuser
USER appuser

EXPOSE 5000

CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "5000"]
```

### Docker Compose - `docker-compose.yml`

```yaml
version: "3.8"

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: interior-web
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3001"
    environment:
      - NODE_ENV=production
      - LLM_API_URL=http://llm:5000
    env_file:
      - .env
    volumes:
      - interior-data:/app/data
    depends_on:
      llm:
        condition: service_healthy
    healthcheck:
      test:
        ["CMD", "wget", "-q", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  llm:
    build:
      context: ./LLM
      dockerfile: Dockerfile
    container_name: interior-llm
    restart: unless-stopped
    ports:
      - "127.0.0.1:5000:5000"
    env_file:
      - .env
    volumes:
      - interior-data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

volumes:
  interior-data:
    name: interior-data
```

---

## Nginx Configuration

### Create `/etc/nginx/sites-available/interior`

```nginx
server {
    listen 80;
    server_name interior.ilutay.com;

    # Redirect HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name interior.ilutay.com;

    # SSL certificates (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/interior.ilutay.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/interior.ilutay.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Increase max body size for image uploads
    client_max_body_size 25M;

    # LLM API routes - proxy to Python backend
    location /llm/ {
        rewrite ^/llm/(.*) /$1 break;
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Longer timeout for AI processing
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # All other routes - proxy to Next.js
    location / {
        proxy_pass http://127.0.0.1:3001;
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

---

## Environment Variables

### Production `.env` File

Create `/opt/interior/.env` (not committed to git):

```env
# Database
DATABASE_URL=file:/app/data/interior.db

# AI Services
ANTHROPIC_API_KEY=sk-ant-xxxxx
BFL_API_KEY=xxxxx

# Storage (S3-compatible)
BLOB_STORAGE_URL=https://s3.amazonaws.com/your-bucket

# LLM Backend (for Next.js to call Python)
LLM_API_URL=http://llm:5000

# Next.js
NEXTAUTH_SECRET=generate-a-secure-random-string
NEXTAUTH_URL=https://interior.ilutay.com
```

### Required API Keys

| Key                 | Service           | Purpose                   |
| ------------------- | ----------------- | ------------------------- |
| `ANTHROPIC_API_KEY` | Anthropic Claude  | AI chat and analysis      |
| `BFL_API_KEY`       | Black Forest Labs | Image generation (Flux 2) |
| `BLOB_STORAGE_URL`  | S3                | Image/PDF storage         |

---

## Deployment Instructions

### Prerequisites

On the VPS:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin

# Install Nginx
sudo apt install nginx

# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Logout and login to apply docker group
```

### Memory Requirements & Swap Setup

Next.js builds are memory-intensive. For VPS with limited RAM (1-4GB), you **must** configure swap to prevent OOM (Out of Memory) kills during Docker builds.

**Minimum requirements:**

| VPS RAM | Recommended Swap | Total Memory |
| ------- | ---------------- | ------------ |
| 1GB     | 4GB              | 5GB          |
| 2GB     | 4GB              | 6GB          |
| 4GB     | 2-4GB            | 6-8GB        |

**Setup swap on Ubuntu (Linode/DigitalOcean/etc):**

```bash
# Check current memory and swap
free -h

# Create 4GB swap file
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent (survives reboot)
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize swap usage for build workloads
sudo sysctl vm.swappiness=60

# Verify swap is active
free -h
```

**Signs of OOM during build:**

- Build process killed with `SIGKILL`
- Build hangs for extended periods then fails
- Error message: `npm error signal SIGKILL`

### Initial Deployment

```bash
# 1. Clone repository
cd /opt
sudo git clone <repo-url> interior
cd interior

# 2. Create production environment file
sudo nano .env
# Paste environment variables (see above)

# 3. Update next.config.mjs for standalone build
# Ensure output: 'standalone' is set

# 4. Build and start containers
sudo docker compose up -d --build

# 5. Configure Nginx
sudo nano /etc/nginx/sites-available/interior
# Paste Nginx config (see above)

# 6. Enable site
sudo ln -s /etc/nginx/sites-available/interior /etc/nginx/sites-enabled/

# 7. Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx

# 8. Setup SSL (run AFTER DNS is configured)
sudo certbot --nginx -d interior.ilutay.com

# 9. Verify deployment
curl -I https://interior.ilutay.com
curl https://interior.ilutay.com/llm/health
```

### Updating the Application

```bash
cd /opt/interior

# Pull latest code
sudo git pull

# Rebuild and restart containers
sudo docker compose up -d --build

# View logs if needed
sudo docker compose logs -f
```

### Rolling Back

```bash
cd /opt/interior

# Revert to previous commit
sudo git checkout HEAD~1

# Rebuild
sudo docker compose up -d --build
```

---

## Useful Commands

### Container Management

```bash
# View running containers
sudo docker compose ps

# View logs
sudo docker compose logs -f          # All services
sudo docker compose logs -f web      # Next.js only
sudo docker compose logs -f llm      # Python only

# Restart services
sudo docker compose restart

# Stop all services
sudo docker compose down

# Stop and remove volumes (⚠️ destroys data)
sudo docker compose down -v
```

### Health Checks

```bash
# Check Next.js
curl http://localhost:3001/api/health

# Check Python LLM
curl http://localhost:5000/health

# Check via Nginx
curl https://interior.ilutay.com/llm/health
```

### Database Access

```bash
# Enter web container
sudo docker compose exec web sh

# Access SQLite (inside container)
sqlite3 /app/data/interior.db

# Backup database
sudo docker compose exec web cat /app/data/interior.db > backup.db
```

---

## Data Persistence

| Data             | Location                              | Persistence       |
| ---------------- | ------------------------------------- | ----------------- |
| SQLite database  | `interior-data` volume → `/app/data/` | Survives rebuilds |
| Uploaded images  | External S3 (BLOB_STORAGE_URL)        | External service  |
| Generated images | External S3                           | External service  |

**Backup strategy:**

```bash
# Backup volume
sudo docker run --rm -v interior-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/interior-data-$(date +%Y%m%d).tar.gz /data
```

---

## Troubleshooting

### Next.js container won't start

```bash
# Check logs
sudo docker compose logs web

# Common issues:
# - Missing standalone output: ensure next.config.mjs has output: 'standalone'
# - Port conflict: check if 3001 is in use
# - Missing .env variables
```

### Python container health check fails

```bash
# Check logs
sudo docker compose logs llm

# Common issues:
# - Missing ANTHROPIC_API_KEY
# - Import errors in Python code
# - Port 5000 already in use
```

### 502 Bad Gateway

```bash
# Check if containers are running
sudo docker compose ps

# Check Nginx config
sudo nginx -t

# Check if ports are exposed correctly
sudo docker compose port web 3001
sudo docker compose port llm 5000
```

### SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal

# Check certificate status
sudo certbot certificates
```

### Build fails with SIGKILL (OOM)

If Docker build fails with `npm error signal SIGKILL` during `npm run build`:

```bash
# 1. Check if swap is configured
free -h

# 2. If no swap, add it (see "Memory Requirements & Swap Setup" above)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. Verify Dockerfile has NODE_OPTIONS set
# Should include: ENV NODE_OPTIONS="--max-old-space-size=4096"

# 4. Retry the build
sudo docker compose build --no-cache

# 5. If still failing, increase memory limit to 8GB
# Edit Dockerfile: ENV NODE_OPTIONS="--max-old-space-size=8192"
```

**Alternative: Build locally and push image**

If your VPS is too constrained, build on your local machine:

```bash
# Local machine (with more RAM)
docker build -t yourusername/interior-web:latest .
docker push yourusername/interior-web:latest

# On VPS - modify docker-compose.yml to use pre-built image
# Replace build: section with: image: yourusername/interior-web:latest
```

---

## API Integration Notes

### Next.js → Python Communication

Inside Docker network, Next.js calls Python using the service name:

```typescript
// In Next.js API route
const LLM_API_URL = process.env.LLM_API_URL || "http://llm:5000";

const response = await fetch(`${LLM_API_URL}/analyze`, {
  method: "POST",
  body: formData,
});
```

### External → Python via Nginx

External clients can access Python endpoints via path routing:

```bash
# External call
curl -X POST https://interior.ilutay.com/llm/analyze -F "image=@floorplan.png"

# Nginx rewrites /llm/analyze → /analyze and proxies to Python
```

---

## Security Checklist

- [ ] `.env` file not committed to git (add to `.gitignore`)
- [ ] Strong `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
- [ ] SSL enabled via certbot
- [ ] Firewall configured (only 80, 443, 22 open)
- [ ] Docker containers run as non-root users
- [ ] Regular security updates (`sudo apt update && sudo apt upgrade`)

---

## Monitoring (Docker Healthchecks)

Built-in healthchecks restart unhealthy containers:

- **Next.js:** Checks `/api/health` every 30s
- **Python:** Checks `/health` every 30s

View health status:

```bash
sudo docker compose ps
# Shows: healthy, unhealthy, starting
```
