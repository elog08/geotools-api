const express = require('express');

const LocationStore = require('../libs/LocationStore');

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

app.get('/', async (req, res) => {
  if (!validate(req)) {
    res.status(400);
    res.send({
      success: false,
      message: '[latitude, longitude] required. [count and distance] are optional',
    });
  } else {
    const { latitude, longitude, distance = 50000, count = 10 } = req.query;
    const searchQuery = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      distance: parseInt(distance),
      count: parseInt(count),
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
  app.store = new LocationStore();
  return new Promise((resolve, reject) => {
    expressHandle = app
      .listen(process.env.PORT || 3000, resolve)
      .once('error', reject);
  });
};

app.shutdown = async function shutdown() {
  await app.store.disconnect();
  return expressHandle.close();
};

module.exports = app;