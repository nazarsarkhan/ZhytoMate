function normalizeImage(image, fallbackAlt = "") {
  const url = typeof image === "string" ? image.trim() : image?.url?.trim?.();
  if (!url) return null;

  return {
    url,
    alt: typeof image === "string" ? fallbackAlt : image.alt?.trim?.() || fallbackAlt,
    caption: typeof image === "string" ? "" : image.caption?.trim?.() || "",
  };
}

export function getNewsImages(item) {
  const fallbackAlt = item?.title || "Зображення новини";
  const candidates = [
    normalizeImage(item?.coverImageUrl, fallbackAlt),
    ...(Array.isArray(item?.images) ? item.images.map((image) => normalizeImage(image, fallbackAlt)) : []),
  ].filter(Boolean);
  const seen = new Set();

  return candidates.filter((image) => {
    if (seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}

export function getNewsCoverImage(item) {
  return getNewsImages(item)[0] || null;
}
