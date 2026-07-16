import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/myapp",
  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    "dev-access-secret-change-me",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET ||
    "dev-refresh-secret-change-me",
  jwtAccessExpiresIn:
    process.env.JWT_ACCESS_EXPIRES_IN || process.env.ACCESS_TOKEN_TTL || "15m",
  jwtRefreshExpiresIn:
    process.env.JWT_REFRESH_EXPIRES_IN || process.env.REFRESH_TOKEN_TTL || "7d",
  mlBaseUrl: process.env.ML_BASE_URL || "http://localhost:8000",
  internalToken: process.env.INTERNAL_TOKEN || "",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Address verification/normalization via Nominatim (OpenStreetMap). No API key required, but
  // Nominatim's usage policy REQUIRES an identifying User-Agent and limits to ~1 req/sec. For
  // production, point NOMINATIM_BASE_URL at a self-hosted instance or a paid geocoder.
  nominatimBaseUrl:
    process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org",
  nominatimUserAgent:
    process.env.NOMINATIM_USER_AGENT || "Zhytomate/1.0 (city services app)",
  addressDefaultCity: process.env.ADDRESS_DEFAULT_CITY || "Житомир",
};

if (config.isProd && (
  !process.env.JWT_ACCESS_SECRET
  || !process.env.JWT_REFRESH_SECRET
  || process.env.JWT_ACCESS_SECRET === "dev-access-secret-change-me"
  || process.env.JWT_REFRESH_SECRET === "dev-refresh-secret-change-me"
)) {
  throw new Error("Production requires distinct JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values");
}

export default config;
