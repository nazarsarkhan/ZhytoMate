import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, default: "" },
    building: { type: String, trim: true, default: "" },
    neighborhood: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    // Set by the Nominatim geocoder on save: whether the address resolved to a real place, its
    // coordinates, and the normalized single-line label. `verified:false` still stores the address.
    verified: { type: Boolean, default: false },
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
    formatted: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const preferencesSchema = new mongoose.Schema(
  {
    utilityAlerts: { type: Boolean, default: true },
    cityNews: { type: Boolean, default: true },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    username: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, trim: true, default: "" },
    address: { type: addressSchema, default: () => ({}) },
    preferences: { type: preferencesSchema, default: () => ({}) },
    avatarUrl: { type: String, trim: true, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    refreshTokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);

export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    address: {
      street: user.address?.street || "",
      building: user.address?.building || "",
      neighborhood: user.address?.neighborhood || "",
      district: user.address?.district || "",
      city: user.address?.city || "",
      verified: user.address?.verified || false,
      lat: user.address?.lat ?? null,
      lon: user.address?.lon ?? null,
      formatted: user.address?.formatted || "",
    },
    preferences: {
      utilityAlerts: user.preferences?.utilityAlerts ?? true,
      cityNews: user.preferences?.cityNews ?? true,
    },
    avatarUrl: user.avatarUrl || "",
    role: user.role,
  };
}

export default User;
