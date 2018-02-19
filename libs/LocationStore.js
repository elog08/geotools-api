const redis = process.env.TEST_MODE ? require('fakeredis') : require('redis');
const georedis = require('georedis');
const bluebird = require('bluebird');

// Promise support for the redis client
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

/**
 * Interface for Location
 *
 * @class Location
 */
class Location {
  /**
   * Creates an instance of Location.
   * @param {String} id - Unique ID, replaces entry in DB if already exists
   * @param {Number} latitude - Latitude as float
   * @param {Number} longitude - Longitude as float
   * @param {Object} meta - Meta information
   * @memberof Location
   */
  constructor(id, { latitude, longitude, meta = {} }) {
    if (!(id && latitude && longitude)) {
      throw Error('Invalid location passed');
    }
    this.id = id;
    this.latitude = latitude;
    this.longitude = longitude;
    this.meta = {};
  }

  get jsonString() {
    return JSON.stringify(this);
  }
}

/**
 * Wrapper around GeoRedis
 * Provides a basic CRUd interface
 *
 * @class Location
 */
class LocationStore {
  /**
   * Creates an instance of LocationStore.
   * @param {any} config
   * @memberof LocationStore
   */
  constructor(config = {}) {
    const {
      redisConfig = {
        host: 'localhost',
        port: '6379',
      },
    } = config;

    // Since redis connections are async, boolean to check if connection is active
    this.ready = false;

    this.redisClient = redis.createClient(redisConfig);
    this.geoClient = georedis.initialize(this.redisClient);

    // Event handlers for connections
    this.redisClient.on('ready', () => {
      this.ready = true;
    });

    this.redisClient.on('error', () => {
      this.ready = false;
    });
  }

  /**
   * Adds a location to the store and resolves promise
   *
   * @param {Location} obj
   * @returns Promise
   * @memberof LocationStore
   */
  async addLoc(id, obj) {
    const loc = new Location(id, obj);
    // Add metadata to redis
    await this.redisClient.setAsync(`meta_${id}`, loc.jsonString);
    return new Promise((resolve, reject) => {
      // Add to geo index
      this.geoClient.addLocation(id, loc, (err, reply) => {
        if (err) {
          return reject(err);
        }
        resolve(reply);
      });
    });
  }

  /**
   * Adds an array of locations
   *
   * @param [{Location}] obj
   * @returns Promise
   * @memberof LocationStore
   */
  async addLocBatch(arrObj) {
    const arrLocs = arrObj.map(([id, obj]) => new Location(id, obj));

    // Redis Commands
    const arrMetaCmds = arrLocs.map(({ id, jsonString }) => [
      'set',
      `meta_${id}`,
      jsonString,
    ]);
    const arrGeoCmds = Object.assign(
      ...arrLocs.map(({ id, latitude, longitude }) => ({
        [id]: { latitude, longitude },
      })),);

    const pAddMeta = this.redisClient.multi(arrMetaCmds).execAsync();
    const pAddGeo = new Promise((resolve, reject) =>
      this.geoClient.addLocations(arrGeoCmds, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      }),);
    const results = await Promise.all([pAddMeta, pAddGeo]);
    return results[0].length === results[1].length;
  }

  /**
   * Gets locations given an array of IDs
   *
   * @param [] arrId
   * @returns Promise
   * @memberof LocationStore
   */
  async getLocBatch(arrId) {
    // Redis Commands
    const pGetMeta = this.redisClient.mgetAsync(arrId).then((arrMeta) => {
      const mapMeta = {};
      for (let i = 0; i < arrMeta.length; i++) {
        const key = arrId[i];
        mapMeta[key] = arrMeta[i];
      }
      return mapMeta;
    });
    const pGetGeo = new Promise((resolve, reject) =>
      this.geoClient.locations(arrId, (err, mapLocations) => {
        if (err) {
          return reject(err);
        }
        return resolve(mapLocations);
      })
   );
    const [mapMeta, mapGeo] = await Promise.all([pGetMeta, pGetGeo]);
    const arrConsolidated = [];
    const keys = Object.keys(mapMeta);
    for (let i = 0; i < keys.length; i += 1) {
      const id = keys[i];
      const consolidated = Object.assign(
        {},
        JSON.parse(mapMeta[id]),
        mapGeo[id],
      );
      if (Object.keys(consolidated).length > 0) {
        arrConsolidated.push(consolidated);
      }
    }
    return arrConsolidated;
  }

  /**
   * Gets geo information and associated metadata
   *
   * @param {any} id
   * @returns Promise
   * @async
   * @memberof LocationStore
   */
  async getLoc(id) {
    // Fetch meta
    const locMeta = await this.redisClient.getAsync(`meta_${id}`);
    return new Promise((resolve, reject) => {
      // Get location
      this.geoClient.location(id, (err, reply) => {
        if (err) {
          return reject(err);
        }
        const result = Object.assign({}, JSON.parse(locMeta), reply);
        resolve(result);
      });
    });
  }

  /**
   * Deletes locations given an array of IDs
   *
   * @param [] arrId
   * @returns Promise
   * @memberof LocationStore
   */
  async delLocBatch(arrId) {
    // Redis Commands
    const arrMetaCmds = arrId.map(id => ['del', `meta_${id}`]);

    const pDelMeta = this.redisClient.multi(arrMetaCmds).execAsync();
    const pDelGeo = new Promise((resolve, reject) =>
      this.geoClient.removeLocations(arrId, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      }));
    const [resMeta, resGeo] = await Promise.all([pDelMeta, pDelGeo]);
    return resMeta.length === resGeo;
  }

  /**
   * Deletes specific id
   *
   * @param {any} id
   * @returns Promise
   * @async
   * @memberof LocationStore
   */
  async delLoc(id) {
    await this.redisClient.delAsync(`meta_${id}`);
    return new Promise((resolve, reject) => {
      // Get location
      this.geoClient.removeLocation(id, (err, reply) => {
        if (err) {
          return reject(err);
        }
        resolve(reply);
      });
    });
  }

  /**
   * Flushes entire database
   *
   * @returns Promise
   * @async
   * @memberof LocationStore
   */
  async reset() {
    return this.redisClient.flushdb();
  }

  /**
   * Disconnects from Redis
   *
   * @returns Promise
   * @async
   * @memberof LocationStore
   */
  async disconnect() {
    await this.redisClient.quit();
  }
}

module.exports = LocationStore;
