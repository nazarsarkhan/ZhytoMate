import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { config } from "../src/config/index.js";
import News from "../src/features/news/news.model.js";
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
    _id: overrides._id || "64b0000000000000000000a0",
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
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeNews(overrides = {}) {
  return {
    _id: overrides._id || "64b000000000000000000201",
    externalId: "parser_1",
    source: "zt-rada",
    sourceUrl: "https://zt-rada.gov.ua/news/1",
    title: "Council update",
    summary: "Short summary",
    body: "Full body",
    bodyHtml: "<p>Full body</p>",
    coverImageUrl: "https://img.example/news-1.jpg",
    images: [],
    category: "city",
    district: null,
    importance: 3,
    importanceLabel: "normal",
    isAnnouncement: false,
    eventDate: null,
    publishedAt: new Date("2026-07-01T09:00:00.000Z"),
    expiresAt: null,
    tags: ["city"],
    lang: "uk",
    createdAt: new Date("2026-07-01T09:00:00.000Z"),
    updatedAt: new Date("2026-07-01T09:00:00.000Z"),
    ...overrides,
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

function installNewsModelStub(seedNews = []) {
  const records = seedNews.map((item) => makeNews(item));

  const restore = patchModel(News, {
    async findOneAndUpdate(filter, update) {
      const existing = records.find((record) => record.externalId === filter.externalId);

      if (existing) {
        Object.assign(existing, update.$set, {
          updatedAt: new Date("2026-07-17T10:00:00.000Z"),
        });
        return existing;
      }

      const created = makeNews({
        _id: "64b000000000000000000299",
        ...update.$set,
        createdAt: new Date("2026-07-17T10:00:00.000Z"),
        updatedAt: new Date("2026-07-17T10:00:00.000Z"),
      });
      records.push(created);
      return created;
    },
    find(filter = {}) {
      const filtered = records.filter((record) => {
        if (filter.category && record.category !== filter.category) {
          return false;
        }

        if (filter.source && record.source !== filter.source) {
          return false;
        }

        if (typeof filter.isAnnouncement === "boolean") {
          return record.isAnnouncement === filter.isAnnouncement;
        }

        return true;
      });

      let sorted = [...filtered];
      let skipped = 0;
      let limited = filtered.length;

      return {
        sort(sort) {
          sorted = [...filtered].sort((left, right) => compareBySort(left, right, sort));
          return this;
        },
        skip(value) {
          skipped = value;
          return this;
        },
        limit(value) {
          limited = value;
          return Promise.resolve(sorted.slice(skipped, skipped + limited));
        },
        then(resolve, reject) {
          const end = typeof limited === "number" ? skipped + limited : undefined;
          return Promise.resolve(sorted.slice(skipped, end)).then(resolve, reject);
        },
      };
    },
    async countDocuments(filter = {}) {
      return records.filter((record) => {
        if (filter.category && record.category !== filter.category) {
          return false;
        }

        if (filter.source && record.source !== filter.source) {
          return false;
        }

        if (typeof filter.isAnnouncement === "boolean") {
          return record.isAnnouncement === filter.isAnnouncement;
        }

        return true;
      }).length;
    },
    async findById(id) {
      return records.find((record) => record._id === id) || null;
    },
    async findByIdAndUpdate(id, update) {
      const record = records.find((entry) => entry._id === id);
      if (!record) {
        return null;
      }

      Object.assign(record, update.$set, { updatedAt: new Date("2026-07-17T10:00:00.000Z") });
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
  });

  return {
    records,
    restore,
  };
}

async function readJson(response) {
  return {
    status: response.status,
    body: await response.json(),
  };
}

test("news admin routes require an authenticated admin", async () => {
  await withServer(async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/news/admin`);
    assert.equal(unauthorized.status, 401);

    const forbidden = await fetch(`${baseUrl}/news/admin`, {
      headers: {
        authorization: `Bearer ${signAccessToken({
          id: "64b000000000000000000001",
          role: "user",
        })}`,
      },
    });

    assert.equal(forbidden.status, 403);
  });
});

test("GET /news/admin filters announcements and GET /news preserves public pagination with announcement filtering", async () => {
  const requesterAdminId = "64b0000000000000000000a1";
  const { restore } = installNewsModelStub([
    makeNews({
      _id: "64b000000000000000000201",
      externalId: "parser_201",
      title: "Announcement first",
      isAnnouncement: true,
      publishedAt: new Date("2026-07-10T09:00:00.000Z"),
      createdAt: new Date("2026-07-10T09:00:00.000Z"),
    }),
    makeNews({
      _id: "64b000000000000000000202",
      externalId: "parser_202",
      title: "Regular news",
      isAnnouncement: false,
      publishedAt: new Date("2026-07-09T09:00:00.000Z"),
      createdAt: new Date("2026-07-09T09:00:00.000Z"),
    }),
    makeNews({
      _id: "64b000000000000000000203",
      externalId: "parser_203",
      title: "Announcement second",
      isAnnouncement: true,
      publishedAt: new Date("2026-07-08T09:00:00.000Z"),
      createdAt: new Date("2026-07-08T09:00:00.000Z"),
    }),
  ]);
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === requesterAdminId ? makeCurrentAdmin({ _id: requesterAdminId }) : null,
  });

  try {
    await withServer(async (baseUrl) => {
      const adminResponse = await fetch(`${baseUrl}/news/admin?isAnnouncement=true`, {
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: requesterAdminId,
            role: "admin",
          })}`,
        },
      });

      const admin = await readJson(adminResponse);
      assert.equal(admin.status, 200);
      assert.deepEqual(
        admin.body.news.map((item) => item.id),
        ["64b000000000000000000201", "64b000000000000000000203"],
      );
      assert.ok(admin.body.news.every((item) => item.isAnnouncement === true));

      const publicResponse = await fetch(`${baseUrl}/news?isAnnouncement=true`, {
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: "64b0000000000000000000a2",
            role: "user",
          })}`,
        },
      });

      const publicPayload = await readJson(publicResponse);
      assert.equal(publicPayload.status, 200);
      assert.deepEqual(
        publicPayload.body.news.map((item) => item.id),
        ["64b000000000000000000201", "64b000000000000000000203"],
      );
      assert.equal(publicPayload.body.pagination.total, 2);
    });
  } finally {
    restoreUserModel();
    restore();
  }
});

test("GET /news keeps public clamping/defaults backward-compatible while ignoring invalid optional filters", async () => {
  const { restore } = installNewsModelStub([
    makeNews({
      _id: "64b000000000000000000207",
      externalId: "parser_207",
      title: "Newest item",
      source: "zt-rada",
      publishedAt: new Date("2026-07-11T09:00:00.000Z"),
      createdAt: new Date("2026-07-11T09:00:00.000Z"),
    }),
    makeNews({
      _id: "64b000000000000000000208",
      externalId: "parser_208",
      title: "Older item",
      source: "zhytomyr-info",
      publishedAt: new Date("2026-07-10T09:00:00.000Z"),
      createdAt: new Date("2026-07-10T09:00:00.000Z"),
    }),
  ]);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/news?page=0&limit=999&category=%20%20&source=%20%20&isAnnouncement=maybe`,
        {
          headers: {
            authorization: `Bearer ${signAccessToken({
              id: "64b0000000000000000000a8",
              role: "user",
            })}`,
          },
        },
      );

      const { status, body } = await readJson(response);
      assert.equal(status, 200);
      assert.equal(body.pagination.page, 1);
      assert.equal(body.pagination.limit, 20);
      assert.equal(body.pagination.total, 2);
      assert.deepEqual(
        body.news.map((item) => item.id),
        ["64b000000000000000000207", "64b000000000000000000208"],
      );
    });
  } finally {
    restore();
  }
});

test("PATCH /news/admin/:id updates editable fields and keeps the public mapping stable", async () => {
  const targetNewsId = "64b000000000000000000204";
  const requesterAdminId = "64b0000000000000000000a3";
  const { restore } = installNewsModelStub([
    makeNews({
      _id: targetNewsId,
      externalId: "parser_204",
      title: "Original title",
      isAnnouncement: false,
    }),
  ]);
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === requesterAdminId ? makeCurrentAdmin({ _id: requesterAdminId }) : null,
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/news/admin/${targetNewsId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: requesterAdminId,
            role: "admin",
          })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Updated title",
          summary: "Updated summary",
          isAnnouncement: true,
          importance: 5,
          tags: ["important", "city"],
        }),
      });

      const { status, body } = await readJson(response);
      assert.equal(status, 200);
      assert.equal(body.news.id, targetNewsId);
      assert.equal(body.news.externalId, "parser_204");
      assert.equal(body.news.title, "Updated title");
      assert.equal(body.news.summary, "Updated summary");
      assert.equal(body.news.isAnnouncement, true);
      assert.equal(body.news.importance, 5);
      assert.deepEqual(body.news.tags, ["important", "city"]);
    });
  } finally {
    restoreUserModel();
    restore();
  }
});

test("PATCH /news/admin/:id requires an authenticated admin", async () => {
  const targetNewsId = "64b000000000000000000209";

  await withServer(async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/news/admin/${targetNewsId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Should fail" }),
    });
    assert.equal(unauthorized.status, 401);

    const forbidden = await fetch(`${baseUrl}/news/admin/${targetNewsId}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${signAccessToken({
          id: "64b0000000000000000000a9",
          role: "user",
        })}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Should still fail" }),
    });
    assert.equal(forbidden.status, 403);
  });
});

test("PATCH /news/admin/:id rejects parser-managed fields outside the editable allowlist", async () => {
  const targetNewsId = "64b000000000000000000205";
  const requesterAdminId = "64b0000000000000000000a4";
  const { restore } = installNewsModelStub([
    makeNews({
      _id: targetNewsId,
      externalId: "parser_205",
    }),
  ]);
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === requesterAdminId ? makeCurrentAdmin({ _id: requesterAdminId }) : null,
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/news/admin/${targetNewsId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: requesterAdminId,
            role: "admin",
          })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          externalId: "tampered",
        }),
      });

      const { status, body } = await readJson(response);
      assert.equal(status, 400);
      assert.match(body.error, /externalId/i);
    });
  } finally {
    restoreUserModel();
    restore();
  }
});

test("DELETE /news/admin/:id deletes the item", async () => {
  const targetNewsId = "64b000000000000000000206";
  const requesterAdminId = "64b0000000000000000000a5";
  const { records, restore } = installNewsModelStub([
    makeNews({
      _id: targetNewsId,
      externalId: "parser_206",
      title: "Delete me",
    }),
  ]);
  const restoreUserModel = patchUserModel({
    findById: async (id) =>
      id === requesterAdminId ? makeCurrentAdmin({ _id: requesterAdminId }) : null,
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/news/admin/${targetNewsId}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: requesterAdminId,
            role: "admin",
          })}`,
        },
      });

      const { status, body } = await readJson(response);
      assert.equal(status, 200);
      assert.deepEqual(body, { id: targetNewsId });
      assert.equal(records.some((item) => item._id === targetNewsId), false);
    });
  } finally {
    restoreUserModel();
    restore();
  }
});

test("DELETE /news/admin/:id requires an authenticated admin", async () => {
  const targetNewsId = "64b000000000000000000210";

  await withServer(async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/news/admin/${targetNewsId}`, {
      method: "DELETE",
    });
    assert.equal(unauthorized.status, 401);

    const forbidden = await fetch(`${baseUrl}/news/admin/${targetNewsId}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${signAccessToken({
          id: "64b0000000000000000000b0",
          role: "user",
        })}`,
      },
    });
    assert.equal(forbidden.status, 403);
  });
});

test("POST /news/ingest remains available with internal-token auth and existing payload validation", async () => {
  const { records, restore } = installNewsModelStub();
  const originalInternalToken = config.internalToken;
  config.internalToken = "task-3-internal-token";

  try {
    await withServer(async (baseUrl) => {
      const unauthorized = await fetch(`${baseUrl}/news/ingest`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          external_id: "parser_ingest_1",
          source: "zt-rada",
          title: "Missing auth should fail",
          summary: "",
          body: "",
          category: "city",
          published_at: "2026-07-17T09:00:00.000Z",
          lang: "uk",
        }),
      });
      assert.equal(unauthorized.status, 401);

      const response = await fetch(`${baseUrl}/news/ingest`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-token": config.internalToken,
        },
        body: JSON.stringify({
          external_id: "parser_ingest_1",
          source: "zt-rada",
          source_url: "https://zt-rada.gov.ua/news/ingest-1",
          title: "Parser ingest still works",
          summary: "",
          body: "",
          category: "city",
          published_at: "2026-07-17T09:00:00.000Z",
          lang: "uk",
          ignored_extra: "strip me",
        }),
      });

      const { status, body } = await readJson(response);
      assert.equal(status, 201);
      assert.equal(body.news.externalId, "parser_ingest_1");
      assert.equal(body.news.title, "Parser ingest still works");
      assert.ok(Array.isArray(records));
      assert.equal(records.at(-1).externalId, "parser_ingest_1");
      assert.equal("ignored_extra" in records.at(-1), false);
    });
  } finally {
    config.internalToken = originalInternalToken;
    restore();
  }
});
