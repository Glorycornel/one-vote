# Web App

Next.js app for One Vote.

## Requirements

- Node.js 20+
- pnpm 9+
- Database with Prisma schema applied
- Redis (Upstash recommended)

## Environment

Create `web/.env` or set env vars:

- `DATABASE_URL` - Prisma database connection string
- `REDIS_URL` - Redis connection string (use `rediss://` for Upstash)

## Local development

From repo root:

```bash
pnpm --dir web dev
```

## Prisma

Generate client:

```bash
pnpm --dir web exec prisma generate
```

Run migrations (if you change schema):

```bash
pnpm --dir web exec prisma migrate deploy
```

## Build and start

```bash
pnpm --dir web build
pnpm --dir web start
```
