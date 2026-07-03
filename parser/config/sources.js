import exampleWebPlugin from '../plugins/web/example-web.js';
import ztRadaPlugin from '../plugins/web/zt-rada.js';
import exampleTgPlugin from '../plugins/tg/example-tg.js';
import zhytomyrCityCouncilPlugin from '../plugins/tg/zhytomyr-city-council.js';
import zhytomyr247Plugin from '../plugins/tg/zhytomyr-24-7.js';
import pzhytomyrPlugin from '../plugins/tg/pzhytomyr.js';

const allWebPlugins = [
  exampleWebPlugin,
  ztRadaPlugin,
  // Import and add additional web plugins here.
];

const allTgPlugins = [
  exampleTgPlugin,
  zhytomyrCityCouncilPlugin,
  zhytomyr247Plugin,
  pzhytomyrPlugin,
];

// Only enabled plugins are exposed to the runtime.
export const webPlugins = allWebPlugins.filter((plugin) => plugin.enabled);
export const tgPlugins = allTgPlugins.filter((plugin) => plugin.enabled);
