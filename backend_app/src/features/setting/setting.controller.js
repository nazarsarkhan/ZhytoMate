import {
  getAdminSettings,
  getPublicSettings,
  updateAdminSettings,
} from "./setting.service.js";

export async function getPublicSettingsResource(_req, res, next) {
  try {
    const settings = await getPublicSettings();
    return res.json({ settings });
  } catch (error) {
    return next(error);
  }
}

export async function getAdminSettingsResource(_req, res, next) {
  try {
    const settings = await getAdminSettings();
    return res.json({ settings });
  } catch (error) {
    return next(error);
  }
}

export async function patchAdminSettingsResource(req, res, next) {
  try {
    const settings = await updateAdminSettings(req.body);
    return res.json({ settings });
  } catch (error) {
    return next(error);
  }
}

export default {
  getPublicSettingsResource,
  getAdminSettingsResource,
  patchAdminSettingsResource,
};
