# ATRETU production deploy runbook

This folder contains portable production templates for a new ATRETU VPS/server.
Do not apply these files directly without replacing placeholders and validating
the target environment.

## Recommended architecture

```text
Internet
  -> Nginx on 80/443
  -> Web Next.js process on WEB_INTERNAL_PORT
  -> API NestJS process on API_INTERNAL_PORT
  -> PostgreSQL
```

Private storage must stay outside the public web root. Nginx must never serve
private documents or bank slip PDFs directly; downloads go through authenticated
and authorized API endpoints.

Initial Sicredi jobs must remain disabled:

```text
SICREDI_SYNC_OPEN_ISSUED_ENABLED=false
SICREDI_ISSUE_BATCH_ENABLED=false
```

Use one API instance for the initial production launch. If the API is scaled
later, add a shared rate-limit store and explicit job coordination.

## Placeholders

Replace these placeholders on the new server:

```text
<WEB_DOMAIN>           example: app.exemplo.com
<API_DOMAIN>           example: api.exemplo.com
<WEB_INTERNAL_PORT>    example: 3000
<API_INTERNAL_PORT>    example: 3333
<ATRETU_COMMIT_OR_TAG> approved production commit or tag
<POSTGRES_HOST>        production database host
<POSTGRES_PASSWORD>    strong database password
<SICREDI_*>            real Sicredi production/sandbox values
```

## Service user and directories

Recommended service user: `atretu`.

Example procedure for the new server only:

```sh
sudo adduser --system --group --home /opt/atretu atretu
sudo install -d -o atretu -g atretu -m 755 /opt/atretu/app
sudo install -d -o atretu -g atretu -m 700 /opt/atretu/env
sudo install -d -o atretu -g atretu -m 700 /opt/atretu/storage
sudo install -d -o atretu -g atretu -m 700 /opt/atretu/storage/private-documents
sudo install -d -o atretu -g atretu -m 700 /opt/atretu/storage/private-documents/finance
sudo install -d -o atretu -g atretu -m 700 /opt/atretu/storage/private-documents/finance/bank-slips
sudo install -d -o atretu -g atretu -m 700 /opt/atretu/backups
sudo install -d -o atretu -g atretu -m 750 /opt/atretu/logs
```

Recommended filesystem policy:

- directories with private data: `700`
- private files and env files: `600`
- owner: the ATRETU service user
- no private storage inside `public`, Nginx root, or the repository

## PostgreSQL

Use a dedicated runtime user. Do not use `postgres`, root, SUPERUSER, CREATEDB,
or CREATEROLE for the app.

Example for the new database server only:

```sql
CREATE DATABASE atretu;
CREATE USER atretu_app WITH PASSWORD '<POSTGRES_PASSWORD>';
GRANT CONNECT ON DATABASE atretu TO atretu_app;
```

Run Prisma migrations with the dedicated user only after backup. Prisma will
create and manage application schema objects through `migrate deploy`.

If PostgreSQL is remote:

- require SSL in the database connection
- allowlist only the application server address
- block public access at firewall/security-group level
- keep backups on separate storage

## Environment

Use `/opt/atretu/env/atretu.env` on the new server with mode `600`, owned by the
service user. Start from `deploy/env/production.env.example`.

Never keep real production secrets in the repository.

## Reproducible build

```sh
cd /opt/atretu/app
git fetch --tags origin
git checkout <ATRETU_COMMIT_OR_TAG>
npm ci
npm run prisma:generate -w @atretu/api
npm run build -w @atretu/api
npm run build -w @atretu/web
```

Current repo requirement: Node.js `>=22`. Use a pinned Node 22 LTS/current build
on the production server. The repository already declares `engines.node`; adding
a `.nvmrc` can be handled in a future hardening sprint if desired.

## Production deploy sequence

1. Create the `atretu` service user.
2. Prepare `/opt/atretu` directories and permissions.
3. Install Node.js `>=22` and npm.
4. Configure PostgreSQL.
5. Create the dedicated database and `atretu_app` user.
6. Configure `/opt/atretu/env/atretu.env` with mode `600`.
7. Configure private storage under `/opt/atretu/storage/private-documents`.
8. Run database and storage backup.
9. Checkout the approved tag or commit.
10. Run `npm ci`.
11. Run `npm run prisma:generate -w @atretu/api`.
12. Run `npx prisma migrate status --schema apps/api/prisma/schema.prisma`.
13. Run `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma`.
14. Run `npm run build -w @atretu/api`.
15. Run `npm run build -w @atretu/web`.
16. Start API and Web with PM2 or systemd.
17. Configure and test Nginx with `nginx -t`.
18. Issue and validate HTTPS certificates.
19. Run internal and public healthchecks.
20. Run the smoke test.
21. Enable monitoring and keep Sicredi jobs off.

## Backup before deploy or migration

Create a timestamp and use it for both database and storage backups.

```sh
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p /opt/atretu/backups/"$TS"
pg_dump --format=custom --file=/opt/atretu/backups/"$TS"/atretu-db.dump "$DATABASE_URL"
tar -C /opt/atretu/storage -czf /opt/atretu/backups/"$TS"/atretu-storage.tar.gz private-documents
```

Minimum retention for the first production period:

- 7 daily backups
- 4 weekly backups
- restoration test before first real go-live

## Migrations

Never run `prisma migrate dev` in production.

```sh
cd /opt/atretu/app
npm run prisma:generate -w @atretu/api
npx prisma migrate status --schema apps/api/prisma/schema.prisma
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Only run `migrate deploy` after backup and after reviewing the migration status
against the production database.

## Process manager

Recommended default: PM2 for the first VPS deployment, because it is simple for
two Node.js processes and provides restart handling and logs. A systemd option
is also provided for environments that standardize on native units.

PM2 does not read `EnvironmentFile` like systemd. Load the production env into
the shell before starting or reloading PM2:

```sh
set -a
. /opt/atretu/env/atretu.env
set +a
pm2 start /opt/atretu/app/deploy/pm2/ecosystem.config.js
pm2 save
```

PM2 template:

- `deploy/pm2/ecosystem.config.js.example`

Systemd templates:

- `deploy/systemd/atretu-api.service.example`
- `deploy/systemd/atretu-web.service.example`

Do not use development servers in production. API must use `node dist/main.js`.
Web should use Next standalone output from `apps/web/.next/standalone`.
The web process reads `PORT`, so set it to the chosen web internal port in the
PM2/systemd process environment.

## Nginx

Templates:

- `deploy/nginx/atretu-web.conf.example`
- `deploy/nginx/atretu-api.conf.example`

Expected behavior:

- HTTP redirects to HTTPS
- TLS 1.2 and TLS 1.3 only
- `client_max_body_size 10m`
- finite proxy timeouts
- forwarded headers aligned with `TRUSTED_PROXY_HOPS=1`
- API and web internal ports are not exposed publicly

Certbot flow on the new server:

```sh
# 1. Point DNS for <WEB_DOMAIN> and <API_DOMAIN> to the server.
# 2. Install HTTP Nginx vhosts.
sudo nginx -t
sudo systemctl reload nginx

# 3. Request certificates.
sudo certbot --nginx -d <WEB_DOMAIN>
sudo certbot --nginx -d <API_DOMAIN>

# 4. Validate HTTPS and renewal.
curl -I https://<WEB_DOMAIN>/
curl -I https://<API_DOMAIN>/health
sudo certbot renew --dry-run
```

## Security headers

Use the Nginx templates for baseline headers:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Frame-Options`

Use CSP in report-only mode first and run the smoke test before enforcement.
Initial compatible CSP example:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https://<API_DOMAIN>;
```

## Firewall

On the new server, expose only:

- `80/tcp`
- `443/tcp`
- SSH according to the infrastructure policy

Do not expose `WEB_INTERNAL_PORT`, `API_INTERNAL_PORT`, or PostgreSQL publicly.

Example only:

```sh
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Healthcheck

Before Nginx:

```sh
curl -fsS http://127.0.0.1:<API_INTERNAL_PORT>/health
```

After Nginx and TLS:

```sh
curl -fsS https://<API_DOMAIN>/health
curl -I https://<WEB_DOMAIN>/
```

Expected API health response:

```json
{"ok":true,"service":"Atretu"}
```

## Smoke test after deploy

Run these checks with production URLs and a controlled admin account:

- login
- dashboard
- students list/search/detail
- public pre-registration
- admin pre-registration review
- reenrollment
- document upload/download
- finance invoices
- collections
- manual movements with attachment
- bank slip batches without uncontrolled Sicredi calls
- official document issue/view/download PDF
- logout
- authenticated route blocked after logout

Sicredi production/homologation flows require explicit approval and controlled
provider credentials. Keep automatic jobs disabled during first boot.

## Monitoring and logs

Monitor:

- API health
- Web availability
- PostgreSQL connectivity
- disk usage
- CPU and RAM
- process restarts
- Nginx 5xx
- 401/403 spikes
- 429 spikes
- Sicredi errors
- batch and job failures

Logging policy:

- production debug off by default
- no secrets, tokens, certificates, raw provider bodies, or unnecessary PII
- PM2: use `pm2-logrotate` or equivalent rotation
- systemd: configure journald size and retention limits

## Rollback

Code:

```sh
cd /opt/atretu/app
git checkout <PREVIOUS_GOOD_TAG_OR_COMMIT>
npm ci
npm run prisma:generate -w @atretu/api
npm run build -w @atretu/api
npm run build -w @atretu/web
pm2 reload deploy/pm2/ecosystem.config.js --env production
```

Database:

- do not blindly roll back migrations
- if a destructive migration breaks production, restore the matching backup
- keep a post-incident dump before restoring

Storage:

- never delete private storage during code rollback
- restore the timestamp-matched storage backup only if storage corruption caused
  the incident

## Accepted security debt for first launch

Document and approve these risks before GO:

- `npm audit`: 5 HIGH and 1 MODERATE currently reported
- Prisma transitive tooling advisories through `deepmerge-ts` and `mysql2`
- Next/PostCSS internal advisory pending a Next major upgrade path
- JWT has no central denylist; TTL is 2h with password-change invalidation
- CSRF relies on OriginCheck plus `SameSite=Lax`, without a formal CSRF token
- rate limit is in memory and only acceptable for one API instance

## Go-live checklist

- [ ] New server selected
- [ ] Service user created
- [ ] Node.js and npm installed
- [ ] PostgreSQL ready
- [ ] Dedicated database/user created
- [ ] Production env configured outside repo
- [ ] Private storage created
- [ ] Backup completed
- [ ] `npm ci` completed
- [ ] Prisma generate completed
- [ ] Migration status reviewed
- [ ] Migration deploy completed
- [ ] API build completed
- [ ] Web build completed
- [ ] PM2 or systemd configured
- [ ] Nginx configured
- [ ] DNS configured
- [ ] HTTPS certificate issued
- [ ] Security headers checked
- [ ] API healthcheck passing
- [ ] Smoke test passing
- [ ] Sicredi jobs still off
- [ ] Monitoring active
