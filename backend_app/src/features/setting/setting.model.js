import mongoose from "mongoose";

export const PUBLIC_SETTING_KEYS = ["cityHotline"];

export const DEFAULT_PUBLIC_SETTINGS = Object.freeze({
  cityHotline: "",
});

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: PUBLIC_SETTING_KEYS,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

export const Setting =
  mongoose.models.Setting || mongoose.model("Setting", settingSchema);

export default Setting;
