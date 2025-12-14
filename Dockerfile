FROM oven/bun:1.3.4 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app

COPY tsconfig.json tsconfig.build.json nest-cli.json eslint.config.mjs .prettierrc ./
COPY src ./src
COPY test ./test

RUN bun run build

FROM oven/bun:1.3.4 AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json bun.lock ./

EXPOSE 3000

CMD ["bun", "dist/main.js"]
