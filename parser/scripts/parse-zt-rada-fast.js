import { runWebSource } from './run-web-source.js';

process.env.ZT_RADA_BACKFILL_DAYS = '30';
process.env.ZT_RADA_MAX_PAGES = '300';
process.env.ZT_RADA_MAX_ITEMS = '1200';
process.env.ZT_RADA_CONCURRENCY = '10';
process.env.ZT_RADA_ATTACHMENT_CONCURRENCY = '4';

const { default: ztRadaPlugin } = await import('../plugins/web/zt-rada.js');

await runWebSource(ztRadaPlugin);
