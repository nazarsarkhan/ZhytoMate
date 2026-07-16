export function getSourceUrl(source) {
  if (typeof source === 'string') return source;
  return typeof source?.source === 'string' ? source.source : '';
}

export function getSourceLabel(source) {
  return getSourceUrl(source) || 'Джерело не вказано';
}

export function isLinkableSource(source) {
  return /^https?:\/\//i.test(getSourceUrl(source));
}

export default { getSourceUrl, getSourceLabel, isLinkableSource };
