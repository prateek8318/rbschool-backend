FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/fee-service/package.json ./services/fee-service/package.json
RUN npm ci
COPY packages/shared ./packages/shared
COPY services/fee-service ./services/fee-service
RUN npm run build -w @rbschool/shared && npm run build -w fee-service
WORKDIR /app/services/fee-service
EXPOSE 3005
CMD ["node", "dist/server.js"]
