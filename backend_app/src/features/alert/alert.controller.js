import { getZhytomyrAlertStatus } from "./alert.client.js";

export async function getStatus(_req, res, next) {
  try {
    return res.json(await getZhytomyrAlertStatus());
  } catch (error) {
    return next(error);
  }
}

export default { getStatus };
