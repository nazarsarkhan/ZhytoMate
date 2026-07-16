import Joi from 'joi';

const CATEGORIES = ['food', 'shopping', 'health', 'services', 'education', 'government', 'culture', 'transport', 'other'];

export const placesQuerySchema = Joi.object({
  q: Joi.string().trim().max(100).optional(),
  category: Joi.string().valid(...CATEGORIES).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lon: Joi.number().min(-180).max(180).optional(),
  radius_m: Joi.number().integer().min(1).max(50000).default(5000),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
}).and('lat', 'lon');

export const placeAdminUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200),
  address: Joi.string().trim().max(300).allow('', null),
  phone: Joi.string().trim().max(80).allow('', null),
  openingHours: Joi.string().trim().max(300).allow('', null),
  category: Joi.string().valid(...CATEGORIES),
}).min(1).unknown(false);

export default { placesQuerySchema, placeAdminUpdateSchema, CATEGORIES };
