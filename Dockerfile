FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies first so this layer is cached
COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
  && corepack prepare pnpm@10 --activate \
  && pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy only what the server needs (never .env or local node_modules)
COPY src ./src
COPY scripts ./scripts
COPY public ./public

ENV PORT=5000
EXPOSE 5000

CMD ["node", "src/server.js"]
