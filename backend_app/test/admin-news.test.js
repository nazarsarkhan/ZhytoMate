import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { config } from "../src/config/index.js";
import News from "../src/features/news/news.model.js";

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

  try {
    await withServer(async (baseUrl) => {
      const adminResponse = await fetch(`${baseUrl}/news/admin?isAnnouncement=true`, {
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: "64b0000000000000000000a1",
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
    restore();
  }
});

test("PATCH /news/admin/:id updates editable fields and keeps the public mapping stable", async () => {
  const targetNewsId = "64b000000000000000000204";
  const { restore } = installNewsModelStub([
    makeNews({
      _id: targetNewsId,
      externalId: "parser_204",
      title: "Original title",
      isAnnouncement: false,
    }),
  ]);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/news/admin/${targetNewsId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: "64b0000000000000000000a3",
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
    restore();
  }
});

test("PATCH /news/admin/:id rejects parser-managed fields outside the editable allowlist", async () => {
  const targetNewsId = "64b000000000000000000205";
  const { restore } = installNewsModelStub([
    makeNews({
      _id: targetNewsId,
      externalId: "parser_205",
    }),
  ]);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/news/admin/${targetNewsId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: "64b0000000000000000000a4",
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
    restore();
  }
});

test("DELETE /news/admin/:id deletes the item", async () => {
  const targetNewsId = "64b000000000000000000206";
  const { records, restore } = installNewsModelStub([
    makeNews({
      _id: targetNewsId,
      externalId: "parser_206",
      title: "Delete me",
    }),
  ]);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/news/admin/${targetNewsId}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${signAccessToken({
            id: "64b0000000000000000000a5",
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
    restore();
  }
});
