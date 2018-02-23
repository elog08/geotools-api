const { readFileSync } = require('fs');
const BigCities = JSON.parse(readFileSync('../data/BigCities.json'));
const LocationStore = require('../libs/LocationStore');

const CITY_LIMIT = 10;
const STATE_LIMIT = 5;

const redisConfig = { host: process.env.REDIS_HOST || "localhost" };
const store = new LocationStore({ redisConfig });
/**
 * Takes a JSON object for a location
 * and returns a shortened ID base on
 * city, state, country_code
 *
 * Can be replaced with a better object hash
 * if the ID doesn't have to be readable
 *
 * @param {any} data
 * @returns {string} shortened name
 */
function getUniqueId(data) {
  let { city, state, country_code } = data;

  // Trim to state limit
  if (state.length > STATE_LIMIT) {
    state = state
      .replace(' ', '')
      .replace(/[^a-zA-Z ]/g, '')
      .replace(/[aeiou]/gi, '')
      .substring(0, 3);
  }

  // Clean up vowels and unsaintly characters
  city = city
    .replace(' ', '')
    .replace(/[^a-zA-Z]/g, '')
    .replace(/[aeiou]/gi, '');

  // Trim more letters
  if (city.length >= CITY_LIMIT) {
    for (let i = city.length; i >= CITY_LIMIT; i--) {
      const c = city[i];
      const rxP = new RegExp(c, 'g');
      const ctM = (city.match(rxP) || []).length;
      if (ctM > 1) {
        city = city.slice(0, i) + (i + 1, city.length);
      }
    }
    city = city
      .slice(0, CITY_LIMIT)
      .toLowerCase()
      .replace(/ /g, '');
  }

  return `${country_code}_${state}_${city}`.toLowerCase() ;
}

(async () => {
  const data = BigCities[2];
  const withId = BigCities.map(loc => [getUniqueId(loc), loc]);

  await store.reset();
  const res = await store.addLocBatch(withId);
  if (res) {
    console.info('Import success!');
  } else {
    console.warn('Import inconsistency!');
  }
  await store.disconnect();
})();
