FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/attendance-service/package.json ./services/attendance-service/package.json
RUN npm ci
COPY packages/shared ./packages/shared
COPY services/attendance-service ./services/attendance-service
RUN npm run build -w @rbschool/shared && npm run build -w attendance-service
WORKDIR /app/services/attendance-service
EXPOSE 3004
CMD ["node", "dist/server.js"]
