FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/user-service/package.json ./services/user-service/package.json
RUN npm ci
COPY packages/shared ./packages/shared
COPY services/user-service ./services/user-service
RUN npm run build -w @rbschool/shared && npm run build -w user-service
WORKDIR /app/services/user-service
EXPOSE 3002
CMD ["node", "dist/server.js"]
