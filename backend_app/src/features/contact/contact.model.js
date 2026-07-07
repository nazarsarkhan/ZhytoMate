import mongoose from "mongoose";

// A single city contact entry (emergency line or utility/admin service). Admins manage these; the
// public Contacts tab renders them. `kind` splits the emergency grid from the grouped utility list;
// `group` is only meaningful for utility contacts (the section heading), and `order` controls the
// display order within a kind/group.
export const CONTACT_KINDS = ["emergency", "utility"];

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    icon: { type: String, trim: true, default: "call" },
    group: { type: String, trim: true, default: "" },
    kind: {
      type: String,
      enum: CONTACT_KINDS,
      default: "utility",
      index: true,
    },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Contact = mongoose.model("Contact", contactSchema);

export function toPublicContact(contact) {
  return {
    id: contact._id.toString(),
    name: contact.name,
    phone: contact.phone,
    icon: contact.icon || "call",
    group: contact.group || "",
    kind: contact.kind,
    order: contact.order ?? 0,
    isActive: contact.isActive,
  };
}

export default Contact;
