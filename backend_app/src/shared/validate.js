import { ApiError } from "./ApiError.js";

export function validate(schema, source = "body") {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((detail) => detail.message).join("; ");
      return next(ApiError.badRequest(`Validation error: ${message}`));
    }

    req[source] = value;
    next();
  };
}

// Express 5 makes req.query a getter-only property, so validate(schema, "query") would throw on
// the `req[source] = value` reassignment. This variant validates the query string and exposes the
// coerced/defaulted result on req.validatedQuery for the controller to read.
export function validateQuery(schema) {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((detail) => detail.message).join("; ");
      return next(ApiError.badRequest(`Validation error: ${message}`));
    }

    req.validatedQuery = value;
    next();
  };
}

export default validate;
