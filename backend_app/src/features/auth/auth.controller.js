import {
  changePassword,
  getCurrentUser,
  login,
  refreshAccessToken,
  register,
} from "./auth.service.js";

export async function registerUser(req, res, next) {
  try {
    const { username, firstName, lastName, email, password } = req.body;
    const result = await register({
      username,
      firstName,
      lastName,
      email,
      password,
    });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function loginUser(req, res, next) {
  try {
    const { login: emailOrUsername, password } = req.body;
    const result = await login({ emailOrUsername, password });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function refreshToken(req, res, next) {
  try {
    const { refreshToken: refreshTokenValue } = req.body;
    const result = await refreshAccessToken(refreshTokenValue);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await getCurrentUser(req.user.id);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await changePassword({
      userId: req.user.id,
      currentPassword,
      newPassword,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export default {
  registerUser,
  loginUser,
  refreshToken,
  me,
  changePasswordHandler,
};
