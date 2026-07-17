import { runWebSource } from './run-web-source.js';

process.env.ZT_RADA_KNOWLEDGE_ONLY = 'true';
process.env.ZT_RADA_DOCUMENTS_ONLY = 'false';
process.env.ZT_RADA_BACKFILL_DAYS = '365';
process.env.ZT_RADA_MAX_PAGES = '120';
process.env.ZT_RADA_MAX_ITEMS = '1000';
process.env.ZT_RADA_CONCURRENCY = '10';
process.env.ZT_RADA_ATTACHMENT_CONCURRENCY = '4';

const { default: ztRadaPlugin } = await import('../plugins/web/zt-rada.js');

await runWebSource(ztRadaPlugin);
