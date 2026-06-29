import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { ApiError } from "../../shared/ApiError.js";

export function authenticate(req, _res, next) {
  const header = req.get("authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    return next(ApiError.unauthorized("Access token is required"));
  }

  try {
    const decodedAccessToken = jwt.verify(token, config.jwtAccessSecret);
    if (decodedAccessToken.type !== "access" || !decodedAccessToken.sub) {
      throw new Error("Invalid token type");
    }

    req.user = {
      id: decodedAccessToken.sub,
      role: decodedAccessToken.role,
    };

    return next();
  } catch {
    return next(ApiError.unauthorized("Invalid or expired access token"));
  }
}

export default authenticate;
