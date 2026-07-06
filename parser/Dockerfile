# Self-contained build context (parser/ has no cross-directory dependencies, unlike backend_app).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "index.js"]
