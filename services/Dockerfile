FROM oven/bun:1.4.2
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
COPY services ./services
USER bun
ENV NODE_ENV=production
EXPOSE 3210
CMD ["bun", "run", "services/server.ts"]
