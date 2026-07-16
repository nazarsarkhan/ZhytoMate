import { importPlaces } from '../../scripts/import-osm-places.js';

export function createPlacesSync({ bbox, collection, fetchPlaces }) {
  const status = { lastRunAt: null, lastRunStatus: 'never', lastImported: 0, lastError: null };

  return {
    async run() {
      try {
        await collection.createIndex({ sourceId: 1 }, { unique: true });
        await collection.createIndex({ location: '2dsphere' });
        const result = await importPlaces({ bbox, collection, fetchPlaces });
        status.lastRunAt = new Date().toISOString();
        status.lastRunStatus = 'ok';
        status.lastImported = result.imported;
        status.lastError = null;
        return result;
      } catch (error) {
        status.lastRunAt = new Date().toISOString();
        status.lastRunStatus = 'failed';
        status.lastError = error.message;
        throw error;
      }
    },
    getStatus() {
      return { ...status };
    },
  };
}

export default { createPlacesSync };
