import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
import cors from "cors";
import express from "express";
import authRoutes from "./features/auth/auth.routes.js";
import userRoutes from "./features/user/user.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/auth", authRoutes);
  app.use("/users", userRoutes);

  // Handle 404 errors
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

  // other error handling middleware can be added here
  app.use(errorHandler);

  return app;
}

export default createApp;
