import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { config } from "../src/config/index.js";
import User, { AdminUserMutationState } from "../src/features/user/user.model.js";

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

function patchAdminUserMutationStateModel(overrides) {
  return patchModel(AdminUserMutationState, overrides);
}

function installAdminUserUpdateLockStub() {
  let lockToken = "";
  let lockUntil = null;

  return patchAdminUserMutationStateModel({
    findOneAndUpdate: async (filter, update) => {
      const now = new Date();
      const isUnlocked = lockUntil === null || lockUntil <= now;
      const wantsKey = filter.key === "admin-user-update";

      if (!wantsKey) {
        return null;
      }

      if (!isUnlocked) {
        return { key: filter.key, lockToken, lockUntil };
      }

      lockToken = update.$set.lockToken;
      lockUntil = update.$set.lockUntil;
      return { key: filter.key, lockToken, lockUntil };
    },
    updateOne: async (filter, update) => {
      if (filter.key === "admin-user-update" && filter.lockToken === lockToken) {
        lockToken = update.$set.lockToken;
        lockUntil = update.$set.lockUntil;
        return { acknowledged: true, modifiedCount: 1 };
      }

      return { acknowledged: true, modifiedCount: 0 };
    },
  });
}

function makeUser(overrides = {}) {
  return {
    _id: overrides._id || "64b000000000000000000001",
    username: "citizen",
    firstName: "Citizen",
    lastName: "User",
    email: "citizen@example.com",
    password: "super-secret-hash",
    phone: "+380000000000",
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
    refreshTokenVersion: 7,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeCurrentAdmin(overrides = {}) {
  return makeUser({
    role: "admin",
    isActive: true,
    ...overrides,
  });
}

function applyFilter(records, filter = {}) {
  return records.filter((record) => {
    if (filter.role && record.role !== filter.role) {
      return false;
    }

    if (typeof filter.isActive === "boolean") {
      if (record.isActive !== filter.isActive) {
        return false;
      }
    } else if (filter.isActive && typeof filter.isActive === "object") {
      if (Object.prototype.hasOwnProperty.call(filter.isActive, "$ne")) {
        if (record.isActive === filter.isActive.$ne) {
          return false;
        }
      } else if (Object.prototype.hasOwnProperty.call(filter.isActive, "$eq")) {
        if (record.isActive !== filter.isActive.$eq) {
          return false;
        }
      }
    }

    if (Array.isArray(filter.$or) && filter.$or.length > 0) {
      const matches = filter.$or.some((condition) => {
        const [field, rule] = Object.entries(condition)[0] || [];
        const candidate = String(record[field] || "");

        if (rule instanceof RegExp) {
          return rule.test(candidate);
        }

        if (rule && typeof rule === "object" && rule.$regex instanceof RegExp) {
          return rule.$regex.test(candidate);
        }

        if (rule && typeof rule === "object" && typeof rule.$regex === "string") {
          return candidate.toLowerCase().includes(rule.$regex.toLowerCase());
        }

        return candidate === String(rule || "");
      });

      if (!matches) {
        return false;
      }
    }

    return true;
  });
}

function applySort(records, sort = {}) {
  const sortEntries = Object.entries(sort);
  if (sortEntries.length === 0) {
    return [...records];
  }

  return [...records].sort((left, right) => {
    for (const [field, direction] of sortEntries) {
      const leftValue = left[field];
      const rightValue = right[field];

      if (leftValue === rightValue) {
        continue;
      }

      const normalizedLeft = leftValue instanceof Date ? leftValue.getTime() : leftValue;
      const normalizedRight =
        rightValue instanceof Date ? rightValue.getTime() : rightValue;

      if (normalizedLeft < normalizedRight) {
        return direction < 0 ? 1 : -1;
      }

      if (normalizedLeft > normalizedRight) {
        return direction < 0 ? -1 : 1;
      }
    }

    return 0;
  });
}

function createFindChain({ records, capture, projection }) {
  let selectArg;
  let sortArg = {};

  capture.projection = projection;

  return {
    select(value) {
      selectArg = value;
      capture.select = value;
      return this;
    },
    sort(value) {
      sortArg = value;
      capture.sort = value;
      return this;
    },
    async lean() {
      return applySort(records, sortArg);
    },
    then(resolve, reject) {
      return this.lean().then(resolve, reject);
    },
  };
}

async function readJson(response) {
  return {
    status: response.status,
    body: await response.json(),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("GET /users/admin requires an authenticated admin", async () => {
  const restoreUserModel = patchUserModel({
    findById: async () => null,
  });

  try {
    await withServer(async (baseUrl) => {
      const unauthorized = await fetch(`${baseUrl}/users/admin`);
      assert.equal(unauthorized.status, 401);

      const nonAdmin = await fetch(`${baseUrl}/users/admin`, {
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: "64b0000000000000000000aa",
            role: "user",
          })}`,
        },
      });

      assert.equal(nonAdmin.status, 403);
    });
  } finally {
    restoreUserModel();
  }
});

test("GET /users/admin filters users, sorts newest first, and never returns credentials", async () => {
  const capture = {};
  const requesterAdminId = "64b0000000000000000000ab";
  const restoreUserModel = patchUserModel({
    find: (filter = {}, projection) =>
      createFindChain({
        capture,
        projection,
        records: applyFilter(
          [
            makeUser({
              _id: "64b000000000000000000010",
              username: "ann-old",
              firstName: "Ann",
              lastName: "Older",
              email: "ann.old@example.com",
              role: "admin",
              isActive: true,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            }),
            makeUser({
              _id: "64b000000000000000000011",
              username: "ann-new",
              firstName: "Anna",
              lastName: "Newest",
              email: "anna.new@example.com",
              role: "admin",
              isActive: true,
              createdAt: new Date("2026-01-03T00:00:00.000Z"),
            }),
            makeUser({
              _id: "64b000000000000000000012",
              username: "blocked-ann",
              firstName: "Annette",
              lastName: "Inactive",
              email: "inactive@example.com",
              role: "admin",
              isActive: false,
              createdAt: new Date("2026-01-04T00:00:00.000Z"),
            }),
            makeUser({
              _id: "64b000000000000000000013",
              username: "ordinary-user",
              firstName: "Ann",
              lastName: "Citizen",
              email: "user@example.com",
              role: "user",
              isActive: true,
              createdAt: new Date("2026-01-05T00:00:00.000Z"),
            }),
          ],
          filter,
        ),
      }),
    findById: async (id) =>
      id === requesterAdminId ? makeCurrentAdmin({ _id: requesterAdminId }) : null,
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/users/admin?q=ann&role=admin&isActive=true`,
        {
          headers: {
            authorization: `Bearer ${signAccessToken({
              id: requesterAdminId,
              role: "admin",
            })}`,
          },
        },
      );

      const { status, body } = await readJson(response);

      assert.equal(status, 200);
      assert.deepEqual(
        body.users.map((user) => user.id),
        ["64b000000000000000000011", "64b000000000000000000010"],
      );
      assert.ok(body.users.every((user) => !("password" in user)));
      assert.ok(body.users.every((user) => !("refreshTokenVersion" in user)));
      assert.equal(body.users[0].isActive, true);
      assert.deepEqual(capture.sort, { createdAt: -1, _id: 1 });
      assert.match(String(capture.select || capture.projection || ""), /password/);
      assert.match(
        String(capture.select || capture.projection || ""),
        /refreshTokenVersion/,
      );
    });
  } finally {
    restoreUserModel();
  }
});

test("GET /users/admin rejects invalid filters", async () => {
  const requesterAdminId = "64b0000000000000000000ac";
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === requesterAdminId ? makeCurrentAdmin({ _id: requesterAdminId }) : null,
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/users/admin?role=superadmin`, {
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: requesterAdminId,
            role: "admin",
          })}`,
        },
      });

      const { status, body } = await readJson(response);
      assert.equal(status, 400);
      assert.match(body.error, /validation error/i);
    });
  } finally {
    restoreUserModel();
  }
});

test("PATCH /users/admin/:id updates profile fields, role, and activity state", async () => {
  const targetUserId = "64b000000000000000000020";
  const requesterAdminId = "64b0000000000000000000ad";
  const restoreLockModel = installAdminUserUpdateLockStub();
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === targetUserId
        ? makeUser({
            _id: targetUserId,
            username: "old.username",
            firstName: "Old",
            lastName: "Name",
            email: "old@example.com",
            role: "user",
            isActive: true,
          })
        : id === requesterAdminId
          ? makeCurrentAdmin({ _id: requesterAdminId })
        : null,
    findByIdAndUpdate: async (id, update) =>
      makeUser({
        _id: id,
        ...update.$set,
      }),
    countDocuments: async () => 1,
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/users/admin/${targetUserId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: requesterAdminId,
            role: "admin",
          })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: "new.username",
          firstName: "New",
          lastName: "Name",
          email: "NEW@EXAMPLE.COM",
          phone: "+380971112233",
          role: "admin",
          isActive: false,
        }),
      });

      const { status, body } = await readJson(response);

      assert.equal(status, 200);
      assert.equal(body.user.id, targetUserId);
      assert.equal(body.user.username, "new.username");
      assert.equal(body.user.firstName, "New");
      assert.equal(body.user.email, "new@example.com");
      assert.equal(body.user.role, "admin");
      assert.equal(body.user.isActive, false);
      assert.equal(body.user.password, undefined);
    });
  } finally {
    restoreUserModel();
    restoreLockModel();
  }
});

test("PATCH /users/admin/:id revokes refresh sessions when role or activity changes", async () => {
  const targetUserId = "64b000000000000000000020";
  const requesterAdminId = "64b0000000000000000000ad";
  const updatesSeen = [];
  const restoreLockModel = installAdminUserUpdateLockStub();
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === targetUserId
        ? makeUser({
            _id: targetUserId,
            username: "moderated.user",
            firstName: "Moderated",
            lastName: "User",
            email: "moderated@example.com",
            role: "admin",
            isActive: true,
            refreshTokenVersion: 12,
          })
        : id === requesterAdminId
          ? makeCurrentAdmin({ _id: requesterAdminId })
        : null,
    findByIdAndUpdate: async (id, update) => {
      updatesSeen.push(update);
      return makeUser({
        _id: id,
        role: update.$set?.role ?? "admin",
        isActive: update.$set?.isActive ?? true,
        refreshTokenVersion:
          12 + (typeof update.$inc?.refreshTokenVersion === "number"
            ? update.$inc.refreshTokenVersion
            : 0),
      });
    },
    countDocuments: async () => 1,
  });

  try {
    await withServer(async (baseUrl) => {
      const demotionResponse = await fetch(`${baseUrl}/users/admin/${targetUserId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: requesterAdminId,
            role: "admin",
          })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "user",
        }),
      });
      assert.equal(demotionResponse.status, 200);

      const deactivateResponse = await fetch(`${baseUrl}/users/admin/${targetUserId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: requesterAdminId,
            role: "admin",
          })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          isActive: false,
        }),
      });
      assert.equal(deactivateResponse.status, 200);

      assert.equal(updatesSeen.length, 2);
      assert.equal(updatesSeen[0].$inc?.refreshTokenVersion, 1);
      assert.equal(updatesSeen[1].$inc?.refreshTokenVersion, 1);
    });
  } finally {
    restoreUserModel();
    restoreLockModel();
  }
});

test("PATCH /users/admin/:id requires an authenticated admin", async () => {
  const targetUserId = "64b0000000000000000000b0";

  await withServer(async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/users/admin/${targetUserId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ firstName: "Blocked" }),
    });

    assert.equal(unauthorized.status, 401);

    const forbidden = await fetch(`${baseUrl}/users/admin/${targetUserId}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${signAccessToken({
          id: "64b0000000000000000000b1",
          role: "user",
        })}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ firstName: "Blocked" }),
    });

    assert.equal(forbidden.status, 403);
  });
});

test("PATCH /users/admin/:id refuses to remove the last active admin", async () => {
  const targetUserId = "64b000000000000000000021";
  const requesterAdminId = "64b0000000000000000000ae";
  const restoreLockModel = installAdminUserUpdateLockStub();
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === targetUserId
        ? makeUser({
            _id: targetUserId,
            username: "last-admin",
            role: "admin",
            isActive: true,
          })
        : id === requesterAdminId
          ? makeCurrentAdmin({ _id: requesterAdminId })
        : null,
    countDocuments: async () => 0,
    findByIdAndUpdate: async () => {
      throw new Error("The last active admin must not be updated");
    },
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/users/admin/${targetUserId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: requesterAdminId,
            role: "admin",
          })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ isActive: false }),
      });

      const { status, body } = await readJson(response);

      assert.equal(status, 409);
      assert.match(body.error, /last active admin/i);
    });
  } finally {
    restoreUserModel();
    restoreLockModel();
  }
});

test("PATCH /users/admin/:id preserves the last active admin under concurrent demotions", async () => {
  const firstAdminId = "64b000000000000000000031";
  const secondAdminId = "64b000000000000000000032";
  const requesterAdminId = "64b0000000000000000000b2";
  const restoreLockModel = installAdminUserUpdateLockStub();
  const usersById = new Map([
    [
      firstAdminId,
      makeUser({
        _id: firstAdminId,
        username: "admin-one",
        role: "admin",
        isActive: true,
      }),
    ],
    [
      secondAdminId,
      makeUser({
        _id: secondAdminId,
        username: "admin-two",
        role: "admin",
        isActive: true,
      }),
    ],
  ]);
  const restoreUserModel = patchUserModel({
    findById: async (id) => {
      if (id === requesterAdminId) {
        return makeCurrentAdmin({
          _id: requesterAdminId,
          username: "request-admin",
        });
      }

      const record = usersById.get(id);
      return record ? makeUser(record) : null;
    },
    countDocuments: async (filter = {}) => {
      const snapshot = [...usersById.values()].filter((user) => {
        if (user.role !== "admin" || user.isActive === false) {
          return false;
        }

        if (filter._id?.$ne && user._id === filter._id.$ne) {
          return false;
        }

        return true;
      }).length;

      await delay(25);
      return snapshot;
    },
    findByIdAndUpdate: async (id, update) => {
      const current = usersById.get(id);
      const next = {
        ...current,
        ...update.$set,
      };
      usersById.set(id, next);
      return makeUser(next);
    },
  });

  try {
    await withServer(async (baseUrl) => {
      const headers = {
        authorization: `Bearer ${signAccessToken({
          id: requesterAdminId,
          role: "admin",
        })}`,
        "content-type": "application/json",
      };

      const [firstResponse, secondResponse] = await Promise.all([
        fetch(`${baseUrl}/users/admin/${firstAdminId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ isActive: false }),
        }),
        fetch(`${baseUrl}/users/admin/${secondAdminId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ isActive: false }),
        }),
      ]);

      const first = await readJson(firstResponse);
      const second = await readJson(secondResponse);
      const statuses = [first.status, second.status].sort((left, right) => left - right);
      const activeAdmins = [...usersById.values()].filter(
        (user) => user.role === "admin" && user.isActive !== false,
      );

      assert.deepEqual(statuses, [200, 409]);
      assert.equal(activeAdmins.length, 1);
      assert.ok(
        [first.body.error, second.body.error].some((value) =>
          /last active admin/i.test(String(value || ""))),
      );
    });
  } finally {
    restoreUserModel();
    restoreLockModel();
  }
});

test("PATCH /users/admin/:id validates the id parameter and update payload", async () => {
  const requesterAdminId = "64b0000000000000000000af";
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === requesterAdminId ? makeCurrentAdmin({ _id: requesterAdminId }) : null,
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/users/admin/not-an-object-id`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: requesterAdminId,
            role: "admin",
          })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ role: "superadmin" }),
      });

      const { status, body } = await readJson(response);

      assert.equal(status, 400);
      assert.match(body.error, /validation error/i);
    });
  } finally {
    restoreUserModel();
  }
});
