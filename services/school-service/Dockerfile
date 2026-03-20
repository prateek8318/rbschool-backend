FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/school-service/package.json ./services/school-service/package.json
RUN npm ci
COPY packages/shared ./packages/shared
COPY services/school-service ./services/school-service
RUN npm run build -w @rbschool/shared && npm run build -w school-service
WORKDIR /app/services/school-service
EXPOSE 3007
CMD ["node", "dist/server.js"]
