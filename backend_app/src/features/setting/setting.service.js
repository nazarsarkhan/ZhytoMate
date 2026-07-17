import {
  DEFAULT_PUBLIC_SETTINGS,
  PUBLIC_SETTING_KEYS,
} from "./setting.model.js";
import {
  findPublicSettings,
  upsertPublicSetting,
} from "./setting.repository.js";

function buildSettingsPayload(records) {
  const settings = { ...DEFAULT_PUBLIC_SETTINGS };

  for (const record of records) {
    if (!PUBLIC_SETTING_KEYS.includes(record.key)) {
      continue;
    }

    settings[record.key] = record.value ?? "";
  }

  return settings;
}

export async function getPublicSettings() {
  const records = await findPublicSettings();
  return buildSettingsPayload(records);
}

export async function getAdminSettings() {
  return getPublicSettings();
}

export async function updateAdminSettings(updates) {
  for (const [key, value] of Object.entries(updates)) {
    if (!PUBLIC_SETTING_KEYS.includes(key)) {
      continue;
    }

    await upsertPublicSetting({ key, value });
  }

  return getPublicSettings();
}

export default {
  getPublicSettings,
  getAdminSettings,
  updateAdminSettings,
};
