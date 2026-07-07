import Contact from "./contact.model.js";

// Public list: only active entries, ordered so the emergency grid and utility groups render
// deterministically (by kind, then group heading, then the admin-defined order, then name).
export function findActiveContacts() {
  return Contact.find({ isActive: true }).sort({
    kind: 1,
    group: 1,
    order: 1,
    name: 1,
  });
}

// Admin list: every contact (including inactive), newest first.
export function findAllContacts() {
  return Contact.find().sort({ createdAt: -1 });
}

export function createContact(data) {
  return Contact.create(data);
}

export function findContactById(id) {
  return Contact.findById(id);
}

export function updateContactById(id, updates) {
  return Contact.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true },
  );
}

export function deleteContactById(id) {
  return Contact.findByIdAndDelete(id);
}

export default {
  findActiveContacts,
  findAllContacts,
  createContact,
  findContactById,
  updateContactById,
  deleteContactById,
};
