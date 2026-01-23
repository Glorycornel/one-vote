# One Vote

Real-time polling app with a Next.js frontend and a Socket.IO backend.

## Prereqs

- Node 20+
- pnpm 9.x

## Install

```bash
pnpm install
```

## Configure environment

Create the environment files:

- `web/.env` (start from `web/.env.example`)
- `realtime/.env` (start from `realtime/.env.example`)

## Database

```bash
cd web
pnpm prisma generate
pnpm prisma migrate dev --name init
```

## Run the app locally

```bash
pnpm dev
```

Or run separately:

```bash
pnpm dev:web
pnpm dev:realtime
```

## Workspace layout

- `web` - Next.js (App Router) UI + REST API
- `realtime` - Express + Socket.IO server

## Useful scripts

- `pnpm build:web`
- `pnpm start:web`
- `pnpm start:realtime`
