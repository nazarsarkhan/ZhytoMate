export class ApiError extends Error {
  constructor(httpStatus, message) {
    super(message);
    this.name = "ApiError";
    this.httpStatus = httpStatus;
    this.isApiError = true;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message) {
    return new ApiError(400, message);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }
  static conflict(message) {
    return new ApiError(409, message);
  }
  static badGateway(message = "Upstream service error") {
    return new ApiError(502, message);
  }
  static gatewayTimeout(message = "Upstream service timed out") {
    return new ApiError(504, message);
  }
}

export default ApiError;
