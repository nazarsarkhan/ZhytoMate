import {
  createContactEntry,
  deleteContactEntry,
  getAdminContacts,
  getPublicContacts,
  updateContactEntry,
} from "./contact.service.js";

// Public (authenticated): grouped contacts for the Contacts tab.
export async function getContacts(_req, res, next) {
  try {
    const contacts = await getPublicContacts();
    return res.json(contacts);
  } catch (err) {
    return next(err);
  }
}

// Admin: flat list for the management table.
export async function getAllContacts(_req, res, next) {
  try {
    const contacts = await getAdminContacts();
    return res.json({ contacts });
  } catch (err) {
    return next(err);
  }
}

export async function createContact(req, res, next) {
  try {
    const contact = await createContactEntry(req.body);
    return res.status(201).json({ contact });
  } catch (err) {
    return next(err);
  }
}

export async function updateContact(req, res, next) {
  try {
    const contact = await updateContactEntry({
      contactId: req.params.id,
      updates: req.body,
    });
    return res.json({ contact });
  } catch (err) {
    return next(err);
  }
}

export async function deleteContact(req, res, next) {
  try {
    const result = await deleteContactEntry(req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export default {
  getContacts,
  getAllContacts,
  createContact,
  updateContact,
  deleteContact,
};
