FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/api-gateway/package.json ./services/api-gateway/package.json
RUN npm ci
COPY packages/shared ./packages/shared
COPY services/api-gateway ./services/api-gateway
RUN npm run build -w @rbschool/shared && npm run build -w api-gateway
WORKDIR /app/services/api-gateway
EXPOSE 8000
CMD ["node", "dist/server.js"]
