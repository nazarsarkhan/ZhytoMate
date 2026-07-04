import mongoose from "mongoose";

const appealSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    imageUrl: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["new", "in_progress", "resolved", "rejected"],
      default: "new",
      index: true,
    },
  },
  { timestamps: true },
);

appealSchema.index({ user: 1, createdAt: -1 });

export const Appeal = mongoose.model("Appeal", appealSchema);

export function toPublicAppeal(appeal) {
  return {
    id: appeal._id.toString(),
    userId: appeal.user.toString(),
    imageUrl: appeal.imageUrl,
    description: appeal.description,
    address: appeal.address,
    status: appeal.status,
    createdAt: appeal.createdAt,
    updatedAt: appeal.updatedAt,
  };
}

export default Appeal;
