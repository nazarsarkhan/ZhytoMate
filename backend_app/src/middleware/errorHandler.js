import { ApiError } from "../shared/ApiError.js";
import { config } from "../config/index.js";

export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError || err?.isApiError) {
    return res.status(err.httpStatus).json({ error: err.message });
  }

  if (err?.code === 11000) {
    return res
      .status(409)
      .json({ error: "Record already exists (duplicate key)" });
  }

  if (err?.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }

  if (err?.isJoi) {
    return res.status(400).json({
      error: err.details.map((detail) => detail.message).join("; "),
    });
  }

  if (err?.name === "MulterError") {
    const messagesByCode = {
      LIMIT_FILE_SIZE: "Photo is too large (max 4MB)",
      LIMIT_UNEXPECTED_FILE: "Unsupported photo type (use JPEG, PNG, or WEBP)",
    };
    return res.status(400).json({ error: messagesByCode[err.code] || "Photo upload failed" });
  }

  console.error("[error]", err);
  return res.status(500).json({
    error: "Internal server error",
    ...(config.isProd ? {} : { detail: err?.message }),
  });
}

export default errorHandler;
