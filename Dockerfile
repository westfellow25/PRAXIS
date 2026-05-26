FROM node:22-slim

WORKDIR /app

COPY package.json ./
COPY index.html styles.css app.js server.js schema.sql README.md DATABASE_SCHEMA.md ./

ENV NODE_ENV=production
ENV PORT=4173

RUN mkdir -p /app/data /app/data/backups

EXPOSE 4173

CMD ["node", "server.js"]
