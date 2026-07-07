import mongoose from "mongoose";

// Must stay in sync with ml-service's vision-analyze category taxonomy
// (ml-service/app/schemas/vision.py) - duplicated here on purpose since the two services are
// separate languages/repos; kept in sync by convention, the same way docs/NODE_SYSTEM_DESIGN.md's
// own DB CHECK constraint duplicates it.
export const APPEAL_CATEGORIES = [
  "pothole",
  "road_damage",
  "garbage",
  "illegal_dumping",
  "street_lighting",
  "water_leak",
  "fallen_tree",
  "vandalism",
  "other",
];

// Shared by createAppealSchema (HTTP/Joi) and createAppeal.action.js (chat/assistant) so the two
// write paths to the same collection can never drift apart on length bounds - see this repo's
// CLAUDE.md Known Issues for the enum-only gap this closes the rest of the way.
export const APPEAL_DESCRIPTION_MIN_LENGTH = 5;
export const APPEAL_DESCRIPTION_MAX_LENGTH = 2000;
export const APPEAL_ADDRESS_MIN_LENGTH = 3;
export const APPEAL_ADDRESS_MAX_LENGTH = 256;

const appealSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Optional: chat-created appeals (assistant actions framework) publish without a photo.
    // Form-created appeals (POST /appeals) still require one via createAppealSchema's Joi
    // validation at the HTTP layer - this relaxation is DB-level only.
    imageUrl: { type: String, trim: true, default: "" },
    category: { type: String, enum: APPEAL_CATEGORIES, required: true },
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
    category: appeal.category,
    description: appeal.description,
    address: appeal.address,
    status: appeal.status,
    createdAt: appeal.createdAt,
    updatedAt: appeal.updatedAt,
  };
}

export default Appeal;
