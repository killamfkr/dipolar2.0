# Dipolar Server – run in Docker (e.g. on a NAS or cloud)
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3333

ENV NODE_ENV=production
ENV PORT=3333

CMD ["node", "index.js"]
