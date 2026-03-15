# Full-stack Dipolar: React app + nginx (API proxied to "server" container)
# Use Debian-based image: npm install often fails on Alpine (musl) with some deps (e.g. optional native modules)
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts --no-optional
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
