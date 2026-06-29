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
};

export default config;
