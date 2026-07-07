import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./swagger/openapi.js";
import { config } from "./config/index.js";
import appealRoutes from "./features/appeal/appeal.routes.js";
import assistantRoutes from "./features/assistant/assistant.routes.js";
import authRoutes from "./features/auth/auth.routes.js";
import contactRoutes from "./features/contact/contact.routes.js";
import conversationRoutes from "./features/conversation/conversation.routes.js";
import newsRoutes from "./features/news/news.routes.js";
import outageRoutes from "./features/outage/outage.routes.js";
import surveyRoutes from "./features/survey/survey.routes.js";
import userRoutes from "./features/user/user.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const FRONTEND_DIST_DIR = path.join(__dirname, "../../frontend_app/dist");
const API_PREFIXES = [
  "/uploads",
  "/auth",
  "/users",
  "/appeals",
  "/surveys",
  "/contacts",
  "/outages",
  "/news",
  "/assistant",
  "/conversations",
  "/docs",
  "/openapi.json",
];

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  // Strip a leading "/api" so the built frontend's apiClient.js (hardcoded API_BASE = "/api" for
  // every fetch/apiUpload call) reaches these same bare routes in production. Mirrors
  // vite.config.js's dev-only proxy rewrite (path.replace(/^\/api/, "")), made permanent since
  // Vite's proxy has no effect on a `vite build` bundle - only on `vite dev`. Operates on req.url
  // (not req.path) so query strings survive intact. "/uploads", "/docs", "/openapi.json" are never
  // called with an "/api" prefix by apiClient.js (uploads are absolute URLs, docs are browsed
  // directly), so they pass through untouched by construction - no special-casing needed.
  app.use((req, res, next) => {
    if (req.url === "/api" || req.url.startsWith("/api/")) {
      req.url = req.url.slice(4) || "/";
    }
    next();
  });

  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
  app.use("/auth", authRoutes);
  app.use("/users", userRoutes);
  app.use("/appeals", appealRoutes);
  app.use("/surveys", surveyRoutes);
  app.use("/contacts", contactRoutes);
  app.use("/outages", outageRoutes);
  app.use("/news", newsRoutes);
  app.use("/assistant", assistantRoutes);
  app.use("/conversations", conversationRoutes);
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get("/openapi.json", (_req, res) => res.json(openApiSpec));

  // Serve the built frontend (single-origin deployment - no CORS needed between the two).
  app.use(express.static(FRONTEND_DIST_DIR));

  // SPA fallback for client-side routing (e.g. a hard refresh on /services/appeals). A bare
  // app.get("*", ...) throws at registration time in Express 5 (path-to-regexp dropped unnamed
  // wildcards) - a plain no-path middleware sidesteps route-pattern parsing entirely. Only GET
  // requests outside the known API prefixes fall through to index.html; everything else still
  // reaches the JSON 404 handler below.
  //
  // Matching requires a trailing "/" after the prefix, not a bare startsWith: the frontend has
  // its own page route named "/assistant" (the Home/Assistant screen), which is also this API's
  // mount point for "/assistant/query". A real API call is always one level under the mount
  // (".../query"), so the bare path alone must fall through here to reach the SPA below instead
  // of dead-ending in assistantRoutes with a JSON 404 - which is exactly what a hard refresh on
  // the app's own home page used to do.
  app.use((req, res, next) => {
    const isApiPath = API_PREFIXES.some((prefix) => req.path.startsWith(`${prefix}/`));
    if (req.method !== "GET" || isApiPath) {
      return next();
    }
    return res.sendFile(path.join(FRONTEND_DIST_DIR, "index.html"), (err) => {
      if (err) next();
    });
  });

  // Handle 404 errors
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

  // other error handling middleware can be added here
  app.use(errorHandler);

  return app;
}

export default createApp;
