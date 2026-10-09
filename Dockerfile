FROM node:24-alpine
WORKDIR /app
COPY index.html ./
COPY server ./server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/server.js"]
