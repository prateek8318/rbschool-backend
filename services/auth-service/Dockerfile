FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/auth-service/package.json ./services/auth-service/package.json
RUN npm ci
COPY packages/shared ./packages/shared
COPY services/auth-service ./services/auth-service
RUN npm run build -w @rbschool/shared && npm run build -w auth-service
WORKDIR /app/services/auth-service
EXPOSE 3001
CMD ["node", "dist/server.js"]
