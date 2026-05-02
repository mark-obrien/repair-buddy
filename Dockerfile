FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# System ffmpeg — avoids the ffmpeg-static binary path issues
RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production
# Point both frames.ts and speech-to-text.ts to the system binary
ENV FFMPEG_PATH=/usr/bin/ffmpeg

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000
CMD ["npm", "start"]
