import { AdminUserMutationState, User } from "./user.model.js";

const ADMIN_USER_SAFE_PROJECTION = "-password -refreshTokenVersion -__v";
const ADMIN_USER_MUTATION_LOCK_KEY = "admin-user-update";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildAdminUserFilter({ q, role, isActive } = {}) {
  const filter = {};

  if (role) {
    filter.role = role;
  }

  if (typeof isActive === "boolean") {
    filter.isActive = isActive ? { $ne: false } : false;
  }

  if (q) {
    const pattern = new RegExp(escapeRegExp(q), "i");
    filter.$or = [
      { firstName: pattern },
      { lastName: pattern },
      { username: pattern },
      { email: pattern },
      { phone: pattern },
    ];
  }

  return filter;
}

export function findUserById(id) {
  return User.findById(id);
}

export function findAllUserIds() {
  return User.find({}, { _id: 1 }).lean().then((users) => users.map(({ _id }) => _id));
}

export function findUserByIdAndUpdateName({ id, firstName, lastName, phone }) {
  return User.findByIdAndUpdate(
    id,
    { firstName, lastName, ...(phone !== undefined ? { phone } : {}) },
    { new: true, runValidators: true },
  );
}

export function findUserByIdAndUpdateAddress({ id, address }) {
  return User.findByIdAndUpdate(
    id,
    { address },
    { new: true, runValidators: true },
  );
}

export function findUserByIdAndUpdatePreferences({ id, preferences }) {
  return User.findByIdAndUpdate(
    id,
    { preferences },
    { new: true, runValidators: true },
  );
}

export function findUserByIdAndUpdateAvatar({ id, avatarUrl }) {
  return User.findByIdAndUpdate(
    id,
    { avatarUrl },
    { new: true, runValidators: true },
  );
}

// Bumping refreshTokenVersion invalidates every previously-issued refresh token, the same
// mechanism auth.service.js's refreshAccessToken() already checks against - so a password change
// signs the user out of every other session, not just the one making the change.
export function findUserByIdAndUpdatePassword({ id, password }) {
  return User.findByIdAndUpdate(
    id,
    { password, $inc: { refreshTokenVersion: 1 } },
    { new: true, runValidators: true },
  );
}

export function findUserByEmailOrUsername(emailOrUsername) {
  return User.findOne({
    $or: [
      { email: emailOrUsername.toLowerCase() },
      { username: emailOrUsername },
    ],
  });
}

export function findAdminUsers(filters = {}) {
  return User.find(buildAdminUserFilter(filters))
    .select(ADMIN_USER_SAFE_PROJECTION)
    .sort({ createdAt: -1, _id: 1 });
}

export function updateAdminUserById(id, updates) {
  return User.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true },
  );
}

export async function acquireAdminUserUpdateLock(token, lockUntil) {
  const now = new Date();

  try {
    const state = await AdminUserMutationState.findOneAndUpdate(
      {
        key: ADMIN_USER_MUTATION_LOCK_KEY,
        $or: [{ lockUntil: null }, { lockUntil: { $lte: now } }],
      },
      {
        $set: {
          lockToken: token,
          lockUntil,
        },
        $setOnInsert: { key: ADMIN_USER_MUTATION_LOCK_KEY },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return state?.lockToken === token ? token : null;
  } catch (error) {
    if (error?.code === 11000) {
      return null;
    }

    throw error;
  }
}

export function releaseAdminUserUpdateLock(token) {
  return AdminUserMutationState.updateOne(
    {
      key: ADMIN_USER_MUTATION_LOCK_KEY,
      lockToken: token,
    },
    {
      $set: {
        lockToken: "",
        lockUntil: null,
      },
    },
  );
}

export function countActiveAdmins({ excludingUserId } = {}) {
  return User.countDocuments({
    role: "admin",
    isActive: { $ne: false },
    ...(excludingUserId ? { _id: { $ne: excludingUserId } } : {}),
  });
}

export function createUser({
  username,
  firstName,
  lastName,
  email,
  password,
  role,
}) {
  return User.create({
    username,
    firstName,
    lastName,
    email,
    password,
    role,
  });
}

export default {
  findUserById,
  findAllUserIds,
  findUserByIdAndUpdateName,
  findUserByIdAndUpdateAddress,
  findUserByIdAndUpdatePreferences,
  findUserByIdAndUpdateAvatar,
  findUserByIdAndUpdatePassword,
  findUserByEmailOrUsername,
  findAdminUsers,
  updateAdminUserById,
  acquireAdminUserUpdateLock,
  releaseAdminUserUpdateLock,
  countActiveAdmins,
  createUser,
};
