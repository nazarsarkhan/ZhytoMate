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
      trim: true,
      default: "",
      validate: {
        validator: (value) => typeof value === "string" && value.length <= 64,
        message: "Setting value must be 64 characters or fewer",
      },
    },
  },
  { timestamps: true },
);

export const Setting =
  mongoose.models.Setting || mongoose.model("Setting", settingSchema);

export default Setting;
