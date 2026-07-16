import { searchPlaces, listPlacesAdmin, updatePlace, deletePlace } from './places.repository.js';

export async function listPlaces(req, res, next) {
  try {
    const result = await searchPlaces(req.validatedQuery ?? req.query);
    return res.json({
      ...result,
      attribution: '© OpenStreetMap contributors',
      catalogUpdatedAt: result.items.reduce((latest, item) => {
        const value = item.catalogUpdatedAt ? new Date(item.catalogUpdatedAt) : null;
        return value && value > latest ? value : latest;
      }, new Date(0)).toISOString(),
    });
  } catch (error) {
    return next(error);
  }
}

export async function listAdminPlaces(req, res, next) {
  try { return res.json({ places: await listPlacesAdmin(req.validatedQuery ?? req.query) }); }
  catch (error) { return next(error); }
}

export async function patchAdminPlace(req, res, next) {
  try {
    const place = await updatePlace(req.params.id, req.validatedBody);
    if (!place) return res.status(404).json({ error: 'Place not found' });
    return res.json({ place });
  } catch (error) { return next(error); }
}

export async function removeAdminPlace(req, res, next) {
  try {
    const place = await deletePlace(req.params.id);
    if (!place) return res.status(404).json({ error: 'Place not found' });
    return res.status(204).send();
  } catch (error) { return next(error); }
}

export default { listPlaces, listAdminPlaces, patchAdminPlace, removeAdminPlace };
