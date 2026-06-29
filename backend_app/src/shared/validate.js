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

export default validate;
