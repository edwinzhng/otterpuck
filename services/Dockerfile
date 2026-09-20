FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
COPY services ./services
RUN bun build services/server.ts --target bun --minify --outfile server.js

FROM oven/bun:1.4.2
WORKDIR /app
COPY --from=build /app/server.js ./server.js
USER bun
ENV NODE_ENV=production
EXPOSE 3210
CMD ["bun", "server.js"]
