const express = require('express');

const LocationStore = require('../libs/LocationStore');

const { PORT = 3000, HOST = '0.0.0.0', REDIS_HOST = 'localhost' } = process.env;

const app = new express();

/**
 * Helper taken from here:
 * https://stackoverflow.com/a/9716488
 *
 * @param {any} n
 * @returns {boolean}
 */
function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function validate(req) {
  const { latitude = false, longitude = false } = req.query;
  return isNumeric(latitude, longitude);
}

app.get('/_dump', async (req, res) => {
  const result = await app.store.all();
  res.send({
    success: true,
    result,
  });
});

app.get('/', async (req, res) => {
  if (!validate(req)) {
    res.status(400);
    res.send({
      success: false,
      message:
        '[latitude, longitude] required. [count, min_population and distance] are optional'
    });
  } else {
    const { latitude, longitude, distance = 50000, count = 10, min_population = 0 } = req.query;
    const searchQuery = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      distance: parseInt(distance),
      count: parseInt(count),
      min_population: parseInt(min_population),
    };
    const result = await app.store.nearby(searchQuery);
    res.send({
      success: true,
      result
    });
  }
});

let expressHandle = null;
app.initialize = async function initialize() {
  const redisConfig = { host: REDIS_HOST };
  app.store = new LocationStore({redisConfig});
  return new Promise((resolve, reject) => {
    expressHandle = app
      .listen(PORT, HOST, () => {
        console.info("Listening on ", {HOST, PORT});
        resolve();
      })
      .once('error', reject);
  });
};

app.shutdown = async function shutdown() {
  await app.store.disconnect();
  return expressHandle.close();
};

module.exports = app;
