FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY game-dev-server.js ./
COPY api/ ./api/
COPY game/ ./game/
COPY japan/ ./japan/
EXPOSE 8137
VOLUME /app/data
ENV DB_PATH=/app/data/game-local-db.json
# a real server: no local-testing perks (every item owned, free smoke bombs)
ENV GAME_DEV=0
CMD ["node", "game-dev-server.js"]
