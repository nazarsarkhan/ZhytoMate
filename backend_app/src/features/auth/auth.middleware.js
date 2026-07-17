import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { ApiError } from "../../shared/ApiError.js";
import { getUserById } from "../user/user.service.js";

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

// Role gate to place right after `authenticate` on admin-only routes, e.g.
// router.get("/", authenticate, authorize("admin"), handler). Relies on `authenticate`
// having already populated req.user.role from the access token.
export function authorize(...roles) {
  return async (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("Admin access is required"));
    }

    try {
      const currentUser = await getUserById(req.user.id);
      if (
        !currentUser ||
        currentUser.isActive === false ||
        !roles.includes(currentUser.role)
      ) {
        return next(ApiError.forbidden("Admin access is required"));
      }

      req.user.role = currentUser.role;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export default authenticate;
