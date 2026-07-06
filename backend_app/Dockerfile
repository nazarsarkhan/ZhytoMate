# Build context: the REPO ROOT (see root docker-compose.yml's backend service: context: ".",
# dockerfile: backend_app/Dockerfile) - not backend_app/ itself. Docker build contexts can't
# reach outside themselves, and backend_app/ + frontend_app/ are sibling directories, so the
# root is the smallest context that can see both.
#
# Two stages: build frontend_app's SPA first, then assemble the backend_app runtime that
# serves it - mirrors the real production topology already documented in root CLAUDE.md
# ("backend_app serves frontend_app's built dist/ directly... single origin, no CORS").
# There is no separate frontend container.

# ---- Stage 1: build the frontend SPA ----
FROM node:22-alpine AS frontend-build
WORKDIR /build/frontend_app
COPY frontend_app/package.json frontend_app/package-lock.json ./
RUN npm ci
COPY frontend_app/ ./
RUN npm run build
# => /build/frontend_app/dist

# ---- Stage 2: backend_app runtime ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/backend_app

COPY backend_app/package.json backend_app/package-lock.json ./
RUN npm ci --omit=dev
COPY backend_app/ ./

# Sibling layout under /app/ mirrors the repo root, so app.js's existing
# path.join(__dirname, "../../frontend_app/dist") resolves correctly with no code change.
COPY --from=frontend-build /build/frontend_app/dist ../frontend_app/dist

EXPOSE 3000
# No `npm start` script exists (only `dev` via nodemon, which isn't even a listed dependency) -
# every doc in this repo runs this service via `node src/server.js` directly.
CMD ["node", "src/server.js"]
