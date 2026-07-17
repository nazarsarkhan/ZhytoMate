/**
 * Decide whether a normalized item belongs in the news output in addition to RAG.
 * RAG receives every valid item; this policy only controls the news collection/API.
 */
export function shouldSendToNews(item, ingestRequest) {
  if (ingestRequest?.doc_type !== 'news') {
    return false;
  }

  // zt-rada has a broad RAG crawl. Only articles discovered from its official news
  // section are public news; documents, calendar entries and evergreen pages stay RAG-only.
  if (item?.source === 'zt-rada') {
    return item.sourceKind === 'news';
  }

  return true;
}
