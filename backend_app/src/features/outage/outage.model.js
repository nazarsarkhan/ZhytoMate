import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    status: { type: String, enum: ["on", "off", "maybe"], required: true },
  },
  { _id: false },
);

const outageAddressCacheSchema = new mongoose.Schema(
  {
    addressKey: { type: String, required: true, unique: true, index: true },
    street: { type: String, default: "" },
    building: { type: String, default: "" },
    neighborhood: { type: String, default: "" },
    district: { type: String, default: "" },
    city: { type: String, default: "" },
    formatted: { type: String, default: "" },
    sourcePageId: { type: Number, default: null },
    queueNumber: { type: Number, default: null },
    subqueue: { type: Number, default: null },
    lastUsedAt: { type: Date, required: true, index: true },
    lastFetchedAt: { type: Date, default: null },
    nextRefreshAt: { type: Date, default: null, index: true },
    lastError: { type: String, default: "" },
  },
  { timestamps: true },
);

const outageScheduleCacheSchema = new mongoose.Schema(
  {
    scheduleKey: { type: String, required: true, unique: true, index: true },
    date: { type: String, required: true, index: true },
    queueNumber: { type: Number, required: true },
    subqueue: { type: Number, required: true },
    slots: { type: [slotSchema], default: [] },
    sourceUpdatedAt: { type: String, default: "" },
    sourceHasActiveCommand: { type: Boolean, default: false },
    fetchedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// MongoDB removes stale schedule rows automatically. Address rows are removed explicitly by the
// sync job because their lifetime depends on whether the address is still used by a user.
outageScheduleCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const outageSyncStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    lockToken: { type: String, default: "" },
    lockUntil: { type: Date, default: null, index: true },
    lastStartedAt: { type: Date, default: null },
    lastFinishedAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  { timestamps: true },
);

export const OutageAddressCache = mongoose.model("OutageAddressCache", outageAddressCacheSchema);
export const OutageScheduleCache = mongoose.model("OutageScheduleCache", outageScheduleCacheSchema);
export const OutageSyncState = mongoose.model("OutageSyncState", outageSyncStateSchema);
