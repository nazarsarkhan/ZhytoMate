import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { config } from "../src/config/index.js";
import User from "../src/features/user/user.model.js";

function signAccessToken({ id, role }) {
  return jwt.sign(
    {
      sub: id,
      role,
      type: "access",
    },
    config.jwtAccessSecret,
    { expiresIn: "15m" },
  );
}

function signRefreshToken({ id, tokenVersion = 0 }) {
  return jwt.sign(
    {
      sub: id,
      tokenVersion,
      type: "refresh",
    },
    config.jwtRefreshSecret,
    { expiresIn: "7d" },
  );
}

async function withServer(run) {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function patchModel(model, overrides) {
  const originals = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    originals.set(key, model[key]);
    model[key] = value;
  }

  return () => {
    for (const [key, value] of originals.entries()) {
      model[key] = value;
    }
  };
}

function patchUserModel(overrides) {
  return patchModel(User, overrides);
}

function createFindChain(records = []) {
  return {
    select() {
      return this;
    },
    sort() {
      return this;
    },
    async lean() {
      return records;
    },
    then(resolve, reject) {
      return this.lean().then(resolve, reject);
    },
  };
}

function makeUser(overrides = {}) {
  return {
    _id: overrides._id || "64b000000000000000000101",
    username: "auth-user",
    firstName: "Auth",
    lastName: "User",
    email: "auth.user@example.com",
    password: overrides.password || "$2b$12$4jvYdT1hFnR7tPcNI0Yvr.rI6z4YfGLwRoTSesFiNUFDXL9uBeb5a",
    phone: "",
    address: {
      street: "",
      building: "",
      neighborhood: "",
      district: "",
      city: "",
      verified: false,
      lat: null,
      lon: null,
      formatted: "",
    },
    preferences: {
      utilityAlerts: true,
      cityNews: true,
    },
    avatarUrl: "",
    role: "user",
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

async function readJson(response) {
  return {
    status: response.status,
    body: await response.json(),
  };
}

test("POST /auth/login rejects inactive users even with a valid password", async () => {
  const password = "CorrectHorseBatteryStaple!";
  const hashedPassword = await bcrypt.hash(password, 4);
  const inactiveUser = makeUser({
    username: "inactive-user",
    email: "inactive@example.com",
    password: hashedPassword,
    isActive: false,
  });
  const restoreUserModel = patchUserModel({
    findOne: async () => inactiveUser,
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          login: inactiveUser.email,
          password,
        }),
      });

      const { status, body } = await readJson(response);

      assert.equal(status, 401);
      assert.match(body.error, /inactive|disabled|invalid/i);
    });
  } finally {
    restoreUserModel();
  }
});

test("POST /auth/refresh rejects inactive users with otherwise-valid refresh tokens", async () => {
  const inactiveUser = makeUser({
    _id: "64b000000000000000000102",
    username: "inactive-refresh",
    email: "inactive.refresh@example.com",
    isActive: false,
    refreshTokenVersion: 9,
  });
  const refreshToken = signRefreshToken({
    id: inactiveUser._id,
    tokenVersion: inactiveUser.refreshTokenVersion,
  });
  const restoreUserModel = patchUserModel({
    findById: async (id) => (id === inactiveUser._id ? inactiveUser : null),
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      const { status, body } = await readJson(response);

      assert.equal(status, 401);
      assert.match(body.error, /inactive|disabled|invalid/i);
    });
  } finally {
    restoreUserModel();
  }
});

test("GET /users/admin denies a stale admin token after the user is demoted", async () => {
  const demotedUser = makeUser({
    _id: "64b000000000000000000103",
    username: "demoted-admin",
    email: "demoted.admin@example.com",
    role: "user",
    isActive: true,
  });
  const restoreUserModel = patchUserModel({
    findById: async (id) => (id === demotedUser._id ? demotedUser : null),
    find: () => createFindChain([]),
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/users/admin`, {
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: demotedUser._id,
            role: "admin",
          })}`,
        },
      });

      const { status, body } = await readJson(response);

      assert.equal(status, 403);
      assert.match(body.error, /admin access/i);
    });
  } finally {
    restoreUserModel();
  }
});

test("GET /users/admin denies a stale admin token after the admin is deactivated", async () => {
  const inactiveAdmin = makeUser({
    _id: "64b000000000000000000104",
    username: "inactive-admin",
    email: "inactive.admin@example.com",
    role: "admin",
    isActive: false,
  });
  const restoreUserModel = patchUserModel({
    findById: async (id) => (id === inactiveAdmin._id ? inactiveAdmin : null),
    find: () => createFindChain([]),
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/users/admin`, {
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: inactiveAdmin._id,
            role: "admin",
          })}`,
        },
      });

      const { status, body } = await readJson(response);

      assert.equal(status, 403);
      assert.match(body.error, /admin access/i);
    });
  } finally {
    restoreUserModel();
  }
});
