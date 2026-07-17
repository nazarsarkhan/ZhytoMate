import Joi from "joi";

const objectId = Joi.string().hex().length(24);

export const notificationsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
});

export const notificationIdParamsSchema = Joi.object({
  id: objectId.required(),
});

export const publishAnnouncementSchema = Joi.object({
  id: Joi.string().trim().min(1).max(160).required(),
  title: Joi.string().trim().min(1).max(160).required(),
  body: Joi.string().trim().min(1).max(4000).required(),
});

export default { notificationsQuerySchema, notificationIdParamsSchema, publishAnnouncementSchema };
