import { Router } from "express";
import { validate } from "../../shared/validate.js";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import {
  createContact,
  deleteContact,
  getAllContacts,
  getContacts,
  updateContact,
} from "./contact.controller.js";
import {
  contactIdParamsSchema,
  createContactSchema,
  updateContactSchema,
} from "./contact.schema.js";

const router = Router();

// Public (authenticated) grouped list for the Contacts tab.
router.get("/", authenticate, getContacts);

// Admin management.
router.get("/admin", authenticate, authorize("admin"), getAllContacts);
router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(createContactSchema),
  createContact,
);
router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(contactIdParamsSchema, "params"),
  validate(updateContactSchema),
  updateContact,
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(contactIdParamsSchema, "params"),
  deleteContact,
);

export default router;
