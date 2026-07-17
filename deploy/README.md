# Server deployment

The root `docker-compose.yml` is the production stack. It runs the frontend through the backend
image, uses two existing external MongoDB databases, keeps PostgreSQL/ML private, and publishes
only these loopback ports for host Nginx:

- `127.0.0.1:3000` — frontend and backend API
- `127.0.0.1:3002` — parser health/API

Point all three DNS A records to the server:

```text
zhytomate.2voby.fun              A <server-ip>
api-zhytomate.2voby.fun          A <server-ip>
parser-zhytomate.2voby.fun       A <server-ip>
```

## First deployment with Cloudflare Flexible SSL

1. Install Docker Compose and Nginx on the server. Do not install origin certificates; TLS is
   terminated by Cloudflare in Flexible mode.
2. Copy `.env.example` to `.env` and set both `APP_MONGO_URI` and `PARSER_MONGO_URI`, plus
   production secrets, OpenAI credentials, and Telegram credentials if Telegram backfill is
   required. Set `CORS_ORIGINS` to the HTTPS frontend origin.
3. Start the stack: `docker compose up -d --build`.
4. In Cloudflare, create proxied DNS records for all three names and set SSL/TLS mode to
   **Flexible**.
5. Install `deploy/nginx/zhytomate-http.conf` as `/etc/nginx/sites-available/zhytomate.conf`,
   enable it, and reload Nginx:

   ```bash
   sudo ln -s /etc/nginx/sites-available/zhytomate.conf /etc/nginx/sites-enabled/zhytomate.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```

The origin only needs port 80 open. Cloudflare provides the public HTTPS certificate; do not add a
server-side HTTP→HTTPS redirect because Flexible mode would create a redirect loop.

The parser performs enabled web-source ingestion on startup. With valid Telegram settings it also
backfills the configured Telegram history.

## Full clean parse

To remove only the old PostgreSQL/pgvector data and start the parser against an empty knowledge
base, run:

```bash
./deploy/reseed.sh
```

MongoDB and `backend_uploads` are preserved. The script does not delete images or source files.
