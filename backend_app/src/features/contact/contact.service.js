import { ApiError } from "../../shared/ApiError.js";
import {
  createContact,
  deleteContactById,
  findActiveContacts,
  findAllContacts,
  findContactById,
  updateContactById,
} from "./contact.repository.js";
import { toPublicContact } from "./contact.model.js";

// Shapes the active contacts into exactly what the Contacts tab consumes:
//   { emergency: [{ id, name, phone, icon }], groups: [{ group, items: [{ id, name, phone, icon }] }] }
export async function getPublicContacts() {
  const contacts = await findActiveContacts();

  const emergency = [];
  const groupsMap = new Map();

  for (const contact of contacts) {
    const view = toPublicContact(contact);
    if (view.kind === "emergency") {
      emergency.push(view);
      continue;
    }
    const groupName = view.group || "Інші служби";
    if (!groupsMap.has(groupName)) {
      groupsMap.set(groupName, []);
    }
    groupsMap.get(groupName).push(view);
  }

  const groups = Array.from(groupsMap.entries()).map(([group, items]) => ({
    group,
    items,
  }));

  return { emergency, groups };
}

// Admin: flat list of every contact for the management table.
export async function getAdminContacts() {
  const contacts = await findAllContacts();
  return contacts.map(toPublicContact);
}

export async function createContactEntry(data) {
  const contact = await createContact(data);
  return toPublicContact(contact);
}

export async function updateContactEntry({ contactId, updates }) {
  const contact = await updateContactById(contactId, updates);
  if (!contact) {
    throw ApiError.notFound("Contact not found");
  }
  return toPublicContact(contact);
}

export async function deleteContactEntry(contactId) {
  const contact = await findContactById(contactId);
  if (!contact) {
    throw ApiError.notFound("Contact not found");
  }
  await deleteContactById(contactId);
  return { id: contactId };
}

export default {
  getPublicContacts,
  getAdminContacts,
  createContactEntry,
  updateContactEntry,
  deleteContactEntry,
};
