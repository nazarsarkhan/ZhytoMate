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

export const APPEAL_STATUSES = ["new", "in_progress", "resolved", "rejected"];

const appealSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    imageUrl: { type: String, required: true, trim: true },
    category: { type: String, enum: APPEAL_CATEGORIES, required: true },
    description: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: APPEAL_STATUSES,
      default: "new",
      index: true,
    },
    // Free-text reply from the city/department shown to the citizen on the appeal detail page.
    // Empty until a moderator responds; the citizen-facing "reviewed" state is derived from status.
    response: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

appealSchema.index({ user: 1, createdAt: -1 });

export const Appeal = mongoose.model("Appeal", appealSchema);

export function toPublicAppeal(appeal) {
  // `user` is an ObjectId on the citizen-facing paths but a populated document on the admin
  // list (findAppeals populates firstName/lastName/email). Detect the populated case so the
  // admin UI can show the reporter's name/email without an extra lookup.
  const isPopulatedUser =
    appeal.user && typeof appeal.user === "object" && appeal.user._id;
  const userId = isPopulatedUser
    ? appeal.user._id.toString()
    : appeal.user.toString();

  return {
    id: appeal._id.toString(),
    userId,
    ...(isPopulatedUser
      ? {
          user: {
            id: userId,
            name: `${appeal.user.firstName ?? ""} ${appeal.user.lastName ?? ""}`.trim(),
            email: appeal.user.email ?? "",
          },
        }
      : {}),
    imageUrl: appeal.imageUrl,
    // Defensive fallback: a handful of legacy appeals predate the required-category taxonomy, so
    // guard against undefined here to keep the citizen-facing API and detail page consistent.
    category: appeal.category || "other",
    description: appeal.description,
    address: appeal.address,
    status: appeal.status,
    response: appeal.response || "",
    createdAt: appeal.createdAt,
    updatedAt: appeal.updatedAt,
  };
}

export default Appeal;
