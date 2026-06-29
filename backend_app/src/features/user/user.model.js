import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    username: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
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
    role: user.role,
  };
}

export default User;
