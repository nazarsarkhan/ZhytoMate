import Setting, { PUBLIC_SETTING_KEYS } from "./setting.model.js";

export function findPublicSettings() {
  return Setting.find({
    key: { $in: PUBLIC_SETTING_KEYS },
  }).sort({ key: 1 });
}

export function upsertPublicSetting({ key, value }) {
  return Setting.findOneAndUpdate(
    { key },
    { $set: { key, value } },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
}

export default {
  findPublicSettings,
  upsertPublicSetting,
};
