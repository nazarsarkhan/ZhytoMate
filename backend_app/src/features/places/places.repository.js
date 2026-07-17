import { Place } from './places.model.js';

export function buildPlacesFilter({ q, category, requireAddress = false }) {
  return {
    category: category || { $ne: 'other' },
    ...(requireAddress ? { address: { $nin: [null, ''] } } : {}),
    ...(q ? { $text: { $search: q } } : {}),
  };
}

export async function searchPlaces({ q, category, lat, lon, radius_m, limit, offset }) {
  const filter = buildPlacesFilter({ q, category, requireAddress: true });
  const distanceFilter = Number.isFinite(lat) && Number.isFinite(lon)
    ? { location: { $near: { $geometry: { type: 'Point', coordinates: [lon, lat] }, $maxDistance: radius_m } } }
    : {};
  const query = Place.find({ ...filter, ...distanceFilter }).skip(offset).limit(limit);
  if (q) query.sort({ score: { $meta: 'textScore' } });
  const [items, total] = await Promise.all([query.lean(), Place.countDocuments({ ...filter, ...distanceFilter })]);
  return { items, total };
}

export async function upsertPlaces(places) {
  if (!places.length) return { upsertedCount: 0, modifiedCount: 0 };
  const operations = places.map((place) => ({
    updateOne: { filter: { sourceId: place.sourceId }, update: { ...place, catalogUpdatedAt: new Date() }, upsert: true },
  }));
  return Place.bulkWrite(operations, { ordered: false });
}

export async function listPlacesAdmin({ q, category, limit = 100 } = {}) {
  const filter = buildPlacesFilter({ q, category });
  return Place.find(filter).sort({ catalogUpdatedAt: -1 }).limit(Math.min(limit, 500)).lean();
}

export async function updatePlace(id, updates) {
  return Place.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
}

export async function deletePlace(id) {
  return Place.findByIdAndDelete(id).lean();
}

export default { buildPlacesFilter, searchPlaces, upsertPlaces, listPlacesAdmin, updatePlace, deletePlace };
