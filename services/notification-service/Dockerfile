FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/notification-service/package.json ./services/notification-service/package.json
RUN npm ci
COPY packages/shared ./packages/shared
COPY services/notification-service ./services/notification-service
RUN npm run build -w @rbschool/shared && npm run build -w notification-service
WORKDIR /app/services/notification-service
EXPOSE 3006
CMD ["node", "dist/server.js"]
