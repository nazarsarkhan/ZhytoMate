import { Router } from 'express';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { ApiError } from '../../shared/ApiError.js';
import { listPlaces, listAdminPlaces, patchAdminPlace, removeAdminPlace } from './places.controller.js';
import { placeAdminUpdateSchema, placesQuerySchema } from './places.schema.js';

const router = Router();
router.get('/admin', authenticate, authorize('admin'), (req, _res, next) => {
  const { value, error } = placesQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
  if (error) return next(ApiError.badRequest(`Validation error: ${error.details.map((detail) => detail.message).join('; ')}`));
  req.validatedQuery = value;
  return next();
}, listAdminPlaces);
router.patch('/admin/:id', authenticate, authorize('admin'), (req, _res, next) => {
  const { value, error } = placeAdminUpdateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) return next(ApiError.badRequest(`Validation error: ${error.details.map((detail) => detail.message).join('; ')}`));
  req.validatedBody = value;
  return next();
}, patchAdminPlace);
router.delete('/admin/:id', authenticate, authorize('admin'), removeAdminPlace);
router.get('/', authenticate, (req, _res, next) => {
  const { value, error } = placesQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
  if (error) {
    return next(ApiError.badRequest(`Validation error: ${error.details.map((detail) => detail.message).join('; ')}`));
  }
  req.validatedQuery = value;
  return next();
}, listPlaces);

export default router;
