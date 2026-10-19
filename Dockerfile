# Image de production : construit le front puis sert front + API avec Node
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/golf-finder.db
VOLUME ["/data"]
EXPOSE 8787
CMD ["npm", "start"]
