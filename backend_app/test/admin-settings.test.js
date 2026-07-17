import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { config } from "../src/config/index.js";
import Contact from "../src/features/contact/contact.model.js";
import User from "../src/features/user/user.model.js";

let contactSequence = 1;

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

function makeCurrentAdmin(overrides = {}) {
  return {
    _id: overrides._id || "64b0000000000000000000c1",
    username: "admin-user",
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com",
    password: "hashed-password",
    phone: "",
    address: {},
    preferences: {},
    avatarUrl: "",
    role: "admin",
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function normalizeContact(contact) {
  const generatedId = contactSequence.toString(16).padStart(24, "0");
  contactSequence += 1;

  return {
    _id: contact._id || generatedId,
    name: contact.name,
    phone: contact.phone,
    icon: contact.icon || "call",
    group: contact.group || "",
    kind: contact.kind || "utility",
    order: contact.order ?? 0,
    isActive: contact.isActive ?? true,
    createdAt: contact.createdAt || new Date(),
    updatedAt: contact.updatedAt || new Date(),
  };
}

function compareBySort(left, right, sort) {
  for (const [field, direction] of Object.entries(sort)) {
    const leftValue = left[field];
    const rightValue = right[field];

    if (leftValue === rightValue) {
      continue;
    }

    const normalizedLeft =
      leftValue instanceof Date ? leftValue.getTime() : leftValue;
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
}

function installContactModelStub(seedContacts = []) {
  const records = seedContacts.map(normalizeContact);

  const restore = patchModel(Contact, {
    find(filter = {}) {
      const filtered = records.filter((record) => {
        if (Object.prototype.hasOwnProperty.call(filter, "isActive")) {
          return record.isActive === filter.isActive;
        }

        return true;
      });

      return {
        sort(sort) {
          return Promise.resolve([...filtered].sort((left, right) => compareBySort(left, right, sort)));
        },
      };
    },
    async create(payload) {
      const record = normalizeContact({
        ...payload,
        createdAt: new Date(`2026-01-${String(records.length + 1).padStart(2, "0")}T00:00:00.000Z`),
      });
      records.push(record);
      return record;
    },
    async findById(id) {
      return records.find((record) => record._id === id) || null;
    },
    async findByIdAndUpdate(id, update) {
      const record = records.find((entry) => entry._id === id);
      if (!record) {
        return null;
      }

      Object.assign(record, update.$set, { updatedAt: new Date() });
      return record;
    },
    async findByIdAndDelete(id) {
      const index = records.findIndex((record) => record._id === id);
      if (index === -1) {
        return null;
      }

      const [deleted] = records.splice(index, 1);
      return deleted;
    },
    async findOne(filter = {}) {
      return (
        records.find((record) =>
          Object.entries(filter).every(([field, value]) => record[field] === value),
        ) || null
      );
    },
  });

  return {
    records,
    restore,
  };
}

test("admin contact CRUD persists order and activity while public contacts stay active-only and ordered", async () => {
  const requesterAdminId = "64b0000000000000000000c1";
  const { restore } = installContactModelStub([
    {
      _id: "64b000000000000000000101",
      name: "Existing utility",
      phone: "111",
      icon: "build",
      kind: "utility",
      group: "Utilities",
      order: 5,
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      _id: "64b000000000000000000102",
      name: "Emergency line",
      phone: "101",
      icon: "call",
      kind: "emergency",
      group: "",
      order: 3,
      isActive: true,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    },
  ]);
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === requesterAdminId ? makeCurrentAdmin({ _id: requesterAdminId }) : null,
  });

  try {
    await withServer(async (baseUrl) => {
      const adminHeaders = {
        "content-type": "application/json",
        authorization: `Bearer ${signAccessToken({
          id: requesterAdminId,
          role: "admin",
        })}`,
      };
      const citizenHeaders = {
        authorization: `Bearer ${signAccessToken({
          id: "citizen-user",
          role: "user",
        })}`,
      };

      const createResponse = await fetch(`${baseUrl}/contacts`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          name: "City hotline",
          phone: "15-80",
          icon: "support_agent",
          kind: "utility",
          group: "Utilities",
          order: 8,
          isActive: false,
        }),
      });

      assert.equal(createResponse.status, 201);
      const createdPayload = await createResponse.json();
      assert.equal(createdPayload.contact.order, 8);
      assert.equal(createdPayload.contact.isActive, false);

      const patchResponse = await fetch(
        `${baseUrl}/contacts/${createdPayload.contact.id}`,
        {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({
            order: 1,
            isActive: true,
          }),
        },
      );

      assert.equal(patchResponse.status, 200);
      const patchedPayload = await patchResponse.json();
      assert.equal(patchedPayload.contact.order, 1);
      assert.equal(patchedPayload.contact.isActive, true);

      const adminListResponse = await fetch(`${baseUrl}/contacts/admin`, {
        headers: adminHeaders,
      });
      assert.equal(adminListResponse.status, 200);
      const adminListPayload = await adminListResponse.json();
      const updatedAdminContact = adminListPayload.contacts.find(
        (contact) => contact.id === createdPayload.contact.id,
      );
      assert.equal(updatedAdminContact.order, 1);
      assert.equal(updatedAdminContact.isActive, true);

      const publicResponse = await fetch(`${baseUrl}/contacts`, {
        headers: citizenHeaders,
      });
      assert.equal(publicResponse.status, 200);
      const publicPayload = await publicResponse.json();
      assert.deepEqual(publicPayload.emergency.map((contact) => contact.name), [
        "Emergency line",
      ]);
      assert.deepEqual(
        publicPayload.groups[0].items.map((contact) => contact.name),
        ["City hotline", "Existing utility"],
      );
    });
  } finally {
    restoreUserModel();
    restore();
  }
});

test("settings routes expose public cityHotline data and keep admin access restricted and allowlisted", async () => {
  const requesterAdminId = "64b0000000000000000000c2";
  const { default: Setting } = await import("../src/features/setting/setting.model.js");
  const settingsStore = new Map([["cityHotline", { key: "cityHotline", value: "15-80" }]]);
  const restore = patchModel(Setting, {
    find(filter = {}) {
      const keys = Array.isArray(filter.key?.$in) ? filter.key.$in : [];
      const records = keys.length
        ? keys.map((key) => settingsStore.get(key)).filter(Boolean)
        : Array.from(settingsStore.values());

      return {
        sort(sort) {
          return Promise.resolve(
            [...records].sort((left, right) => compareBySort(left, right, sort)),
          );
        },
      };
    },
    async findOneAndUpdate(filter, update) {
      const existing = settingsStore.get(filter.key) || { key: filter.key, value: "" };
      const next = {
        ...existing,
        ...update.$set,
      };
      settingsStore.set(filter.key, next);
      return next;
    },
  });
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === requesterAdminId ? makeCurrentAdmin({ _id: requesterAdminId }) : null,
  });

  try {
    await withServer(async (baseUrl) => {
      const publicResponse = await fetch(`${baseUrl}/settings/public`);
      assert.equal(publicResponse.status, 200);
      assert.deepEqual(await publicResponse.json(), {
        settings: {
          cityHotline: "15-80",
        },
      });

      const unauthorizedAdminGet = await fetch(`${baseUrl}/settings/admin`);
      assert.equal(unauthorizedAdminGet.status, 401);

      const forbiddenAdminGet = await fetch(`${baseUrl}/settings/admin`, {
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: "citizen-user",
            role: "user",
          })}`,
        },
      });
      assert.equal(forbiddenAdminGet.status, 403);

      const adminHeaders = {
        "content-type": "application/json",
        authorization: `Bearer ${signAccessToken({
          id: requesterAdminId,
          role: "admin",
        })}`,
      };

      const patchResponse = await fetch(`${baseUrl}/settings/admin`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          cityHotline: "15-88",
        }),
      });
      assert.equal(patchResponse.status, 200);
      assert.deepEqual(await patchResponse.json(), {
        settings: {
          cityHotline: "15-88",
        },
      });

      const adminGetResponse = await fetch(`${baseUrl}/settings/admin`, {
        headers: adminHeaders,
      });
      assert.equal(adminGetResponse.status, 200);
      assert.deepEqual(await adminGetResponse.json(), {
        settings: {
          cityHotline: "15-88",
        },
      });

      const clearResponse = await fetch(`${baseUrl}/settings/admin`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          cityHotline: "",
        }),
      });
      assert.equal(clearResponse.status, 200);
      assert.deepEqual(await clearResponse.json(), {
        settings: {
          cityHotline: "",
        },
      });

      const invalidPatchResponse = await fetch(`${baseUrl}/settings/admin`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          cityHotline: "15-90",
          newsTicker: "not-allowed",
        }),
      });
      assert.equal(invalidPatchResponse.status, 400);
      const invalidPatchBody = await invalidPatchResponse.json();
      assert.match(invalidPatchBody.error, /not allowed/i);
    });
  } finally {
    restoreUserModel();
    restore();
  }
});

test("seed demo upserts contacts and public settings idempotently", async () => {
  process.env.ADMIN_SEED_PASSWORD = "seed-test-password";

  const { default: Setting } = await import("../src/features/setting/setting.model.js");
  const seedModule = await import("../scripts/seed-demo.js");
  const { records: contacts, restore: restoreContacts } = installContactModelStub([
    {
      name: "Поліція",
      phone: "102-custom",
      icon: "shield",
      kind: "emergency",
      group: "",
      order: 99,
      isActive: false,
    },
    {
      name: "Водоканал",
      phone: "0412 custom",
      icon: "water_drop",
      kind: "utility",
      group: "Комунальні служби",
      order: 77,
      isActive: false,
    },
  ]);
  const settingsStore = new Map([["cityHotline", { key: "cityHotline", value: "15-99" }]]);
  const restoreSettings = patchModel(Setting, {
    async findOne(filter) {
      return settingsStore.get(filter.key) || null;
    },
    async findOneAndUpdate(filter, update) {
      const current = settingsStore.get(filter.key) || { key: filter.key, value: "" };
      const next = {
        ...current,
        ...update.$set,
      };
      settingsStore.set(filter.key, next);
      return next;
    },
  });

  try {
    const firstCreatedContacts = await seedModule.seedContacts();
    const secondCreatedContacts = await seedModule.seedContacts();

    assert.equal(firstCreatedContacts, 8);
    assert.equal(secondCreatedContacts, 0);
    assert.deepEqual(
      contacts
        .filter((contact) => ["Поліція", "Водоканал"].includes(contact.name))
        .map((contact) => ({
          name: contact.name,
          phone: contact.phone,
          order: contact.order,
          isActive: contact.isActive,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      [
        {
          name: "Водоканал",
          phone: "0412 custom",
          order: 77,
          isActive: false,
        },
        {
          name: "Поліція",
          phone: "102-custom",
          order: 99,
          isActive: false,
        },
      ],
    );
    assert.deepEqual(
      contacts
        .filter((contact) => contact.kind === "utility" && contact.group === "Комунальні служби")
        .map((contact) => ({ name: contact.name, order: contact.order })),
      [
        { name: "Водоканал", order: 77 },
        { name: "Обленерго", order: 5 },
        { name: "Теплокомуненерго", order: 6 },
        { name: "Ліфтсервіс", order: 7 },
      ],
    );

    const firstEnsuredSettings = await seedModule.seedPublicSettings();
    const secondEnsuredSettings = await seedModule.seedPublicSettings();
    assert.equal(firstEnsuredSettings, 0);
    assert.equal(secondEnsuredSettings, 0);
    assert.deepEqual(settingsStore.get("cityHotline"), {
      key: "cityHotline",
      value: "15-99",
    });
  } finally {
    restoreSettings();
    restoreContacts();
  }
});
