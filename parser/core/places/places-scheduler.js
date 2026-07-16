import cron from 'node-cron';

export function startPlacesScheduler({
  schedule = process.env.PLACES_IMPORT_SCHEDULE || '0 3 * * *',
  run,
  cronImpl = cron,
  logger = console,
}) {
  if (typeof run !== 'function') throw new Error('Places scheduler requires a run function');
  if (!cronImpl.validate(schedule)) throw new Error(`Invalid places import schedule: ${schedule}`);

  const execute = async () => {
    try {
      await run();
    } catch (error) {
      logger.error('[places] scheduled import failed', error);
    }
  };
  const task = cronImpl.schedule(schedule, () => { void execute(); }, { name: 'osm-places-import', noOverlap: true });
  void execute();
  return task;
}

export default { startPlacesScheduler };
