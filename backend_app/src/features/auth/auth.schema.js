import Joi from "joi";

export const registerSchema = Joi.object({
  username: Joi.string().trim().min(3).max(32).required(),
  firstName: Joi.string().trim().min(1).max(64).required(),
  lastName: Joi.string().trim().min(1).max(64).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid("user", "admin").default("user"),
});

export const loginSchema = Joi.object({
  login: Joi.string().trim().required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

export default {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
};
