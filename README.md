# Blend Inspect

Property inspections and maintenance job cards for Blend Property Management, in one Next.js app.

- **Properties**: list with search, filters (client, type, bedrooms, furnishing), buildings with units, CSV export, contacts.
- **Inspections**: schedule from a template, inspect room by room on a phone (Yes / No / N/A checks, descriptions, comments, photos, meter readings, keys), sign-off signatures, printable report and PDF.
- **Job cards**: the Blend job card workflow (request → approve and allocate → work record with before/after photos and contractor signature → tenant acknowledgement → close, or return for rework). A failed inspection item can be turned into a job card in one click, with its photos attached as "before" evidence.
- **People and roles**: administrator, facility manager, portfolio manager, inspector, internal staff, contractor, tenant. Everyone except administrators and inspectors is limited to one property (and its units). People are invited with a one-time link.

Stack: Next.js 15 (App Router, server actions), TypeScript, Tailwind CSS 4, PostgreSQL with Drizzle ORM, email + password sessions stored in Postgres, uploads stored on disk.

The product name lives in `src/lib/brand.ts`.

## Run locally

```bash
cp .env.example .env          # point DATABASE_URL at a local Postgres
npm install
npm run db:migrate
npm run dev                   # http://localhost:3000
```

Open `/signup` to create the first administrator. Sign-up closes after that; invite everyone else from **People**.
Optional made-up demo data: `npm run seed:demo`.

## Deploy on the Hostinger VPS (Docker)

1. Install Docker on the VPS (Hostinger's Ubuntu + Docker template works, or `curl -fsSL https://get.docker.com | sh`).
2. Clone this repo on the VPS and create the env file:
   ```bash
   cp .env.production.example .env.production
   nano .env.production        # set a long random POSTGRES_PASSWORD
   docker compose --env-file .env.production up -d --build
   ```
   The app listens on `127.0.0.1:3000`, and migrations run automatically on start.
3. Put HTTPS in front. With Caddy (`apt install caddy`), `/etc/caddy/Caddyfile`:
   ```
   inspect.blendproperty.co.za {
     reverse_proxy 127.0.0.1:3000
   }
   ```
   Point the domain's A record at the VPS, then `systemctl reload caddy`.
4. Visit the site and create the administrator at `/signup`.

**Backups**: the database is in the `db-data` volume and photos in `uploads`. A nightly dump:
`docker compose exec -T db pg_dump -U blend blend | gzip > backup-$(date +%F).sql.gz`

**Updating**: `git pull && docker compose --env-file .env.production up -d --build`.

## Schema changes

Edit `src/db/schema.ts`, then `npm run db:generate` and commit the new file in `drizzle/`.

## Earlier version

`legacy-cloudflare/` holds the original job card app, which ran on Cloudflare (D1, R2) with Sign in with ChatGPT. Its workflow and roles are carried over into this app. It's kept for reference and can be deleted once the VPS version is live.
