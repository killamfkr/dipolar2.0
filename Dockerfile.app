# App image when dist/ is pre-built (e.g. by CI). Serves UI on / and API on /api (proxy).
FROM nginx:alpine
# Remove default config so our server block is the only one on port 80
RUN rm -f /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=2 \
  CMD wget -q -O - http://127.0.0.1:80/ > /dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
