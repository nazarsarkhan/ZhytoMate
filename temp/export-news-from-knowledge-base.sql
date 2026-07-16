WITH docs AS (
  SELECT
    document_id,
    min(created_at) AS created_at,
    max(expires_at) AS expires_at,
    max(category) AS category,
    max(district) AS district,
    max(source) AS source,
    string_agg(text, E'\n\n' ORDER BY chunk_index) AS body
  FROM public.knowledge_base
  WHERE doc_type = 'news'
  GROUP BY document_id
)
SELECT json_build_object(
  'externalId', document_id,
  'title', left(nullif(regexp_replace(split_part(body, E'\n', 1), '\s+', ' ', 'g'), ''), 140),
  'summary', left(regexp_replace(body, '\s+', ' ', 'g'), 280),
  'body', body,
  'bodyHtml', null,
  'source', 'Міські джерела',
  'sourceUrl', source,
  'coverImageUrl', null,
  'images', json_build_array(),
  'category', coalesce(category, 'other'),
  'district', district,
  'importance', 3,
  'importanceLabel', 'normal',
  'isAnnouncement', false,
  'eventDate', null,
  'publishedAt', created_at,
  'expiresAt', expires_at,
  'tags', json_build_array(coalesce(category, 'other')),
  'lang', 'uk',
  'createdAt', created_at,
  'updatedAt', now()
)::text
FROM docs
ORDER BY created_at DESC;
