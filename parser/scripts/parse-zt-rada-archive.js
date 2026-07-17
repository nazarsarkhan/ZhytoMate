import { runWebSource } from './run-web-source.js';

process.env.ZT_RADA_BACKFILL_FROM = '2019-01-01';
process.env.ZT_RADA_DOCUMENTS_ONLY = 'true';
process.env.ZT_RADA_MAX_PAGES = '0';
process.env.ZT_RADA_MAX_ITEMS = '0';
process.env.ZT_RADA_ATTACHMENT_LIMIT_PER_PAGE = '0';
process.env.ZT_RADA_DOCUMENT_ATTACHMENT_LIMIT_PER_PAGE = '0';
process.env.ZT_RADA_CONCURRENCY = '10';
process.env.ZT_RADA_ATTACHMENT_CONCURRENCY = '4';

const { default: ztRadaPlugin } = await import('../plugins/web/zt-rada.js');

await runWebSource(ztRadaPlugin);
