FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/academic-service/package.json ./services/academic-service/package.json
RUN npm ci
COPY packages/shared ./packages/shared
COPY services/academic-service ./services/academic-service
RUN npm run build -w @rbschool/shared && npm run build -w academic-service
WORKDIR /app/services/academic-service
EXPOSE 3003
CMD ["node", "dist/server.js"]
