FROM node:20-bookworm AS base

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/package.json
COPY realtime/package.json realtime/package.json

FROM base AS web

COPY web ./web

RUN pnpm install --filter web... --frozen-lockfile

RUN pnpm --filter web exec prisma generate

EXPOSE 3000

WORKDIR /app/web

CMD ["pnpm", "--filter", "web", "exec", "next", "dev", "--hostname", "0.0.0.0", "--port", "3000"]

FROM base AS realtime

COPY web/prisma ./web/prisma

RUN pnpm install --frozen-lockfile

COPY realtime ./realtime

EXPOSE 4000

WORKDIR /app/realtime

CMD ["pnpm", "--filter", "realtime", "start"]
