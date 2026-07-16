import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const baseUrl = process.env.ASSISTANT_URL || 'http://localhost:3001';
const datasetPath = process.env.ASSISTANT_DATASET || '../ml-service/eval/datasets/zhytomyr_queries.jsonl';
const cases = (await fs.readFile(datasetPath, 'utf8'))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const suffix = crypto.randomBytes(5).toString('hex');
const credentials = {
  username: `audit_${suffix}`,
  firstName: 'RAG',
  lastName: 'Audit',
  email: `rag-audit-${suffix}@example.com`,
  password: 'RagAuditPassword123!',
};

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body;
}

const registered = await request('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify(credentials),
});
const accessToken = registered.accessToken;

let failures = 0;
for (const testCase of cases) {
  const started = performance.now();
  const body = await request('/api/assistant/query', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ userQuery: testCase.query }),
  });
  const elapsed = Math.round(performance.now() - started);
  const sources = Array.isArray(body.sourcesUsed) ? body.sourcesUsed : [];
  const invariantOk = (body.grounded === true || sources.length === 0)
    && (body.verified !== true || body.grounded === true);
  if (!invariantOk) failures += 1;
  const status = invariantOk ? 'OK' : 'FAIL';
  console.log(
    `${status} | ${String(elapsed).padStart(5)}ms | ${testCase.kind.padEnd(10)} | `
      + `${String(body.answerStatus || '?').padEnd(18)} | grounded=${body.grounded === true} `
      + `verified=${body.verified === true} sources=${sources.length} | ${testCase.query}`,
  );
}

process.exitCode = failures ? 1 : 0;
