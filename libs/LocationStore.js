const redis = process.env.TEST_MODE ? require('fakeredis') : require('redis');
const georedis = require('georedis');
const bluebird = require('bluebird');
const _ = require('lodash');

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
  constructor(id, { latitude, longitude }, meta = {}) {
    if (!(id && latitude && longitude)) {
      throw Error(`Invalid location passed ${JSON.stringify({ id, latitude, longitude })}`,);
    }
    this.id = id;
    this.latitude = latitude;
    this.longitude = longitude;
    this.meta = meta;
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
      console.info('Redis connected');
    });

    this.redisClient.on('error', (e) => {
      this.ready = false;
      console.error('Redis error', e.message);
    });

    this.redisClient.on('end', (e) => {
      this.ready = false;
      console.warn('Redis disconnected');
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
    try {
      const loc = new Location(id, obj, obj);
      // Add metadata to redis
      await this.redisClient.setAsync(id, loc.jsonString);
      return new Promise((resolve, reject) => {
        // Add to geo index
        this.geoClient.addLocation(id, loc, (err, reply) => {
          if (err) {
            return reject(err);
          }
          resolve(reply);
        });
      });
    } catch (error) {
      console.error('LocationStore', 'addLoc', error);
      return false;
    }
  }

  /**
   * Find locations near latitude and longitude
   *
   * @param {latitude} latitude
   * @param {longitude} longitude
   * @param {distance} distance
   * @param {count} max number of results
   * @returns Promise
   * @memberof LocationStore
   */
  async nearby({
 latitude, longitude, distance = 500000, count = 10 
}) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.ready) {
          console.warn('Redis not ready, command will be queued');
        }
        const options = { count, order: true, withDistances: true };
        this.geoClient.nearby(
          { latitude, longitude },
          distance,
          options,
          (err, result) => {
            const arrIds = result.map(res => res.key);
            if (err) return reject(err);
            if (!arrIds || arrIds.length < 1) return resolve(arrIds);

            (async () => {
              this.redisClient.mgetAsync(arrIds).then((arrMeta) => {
                const mapMeta = {};
                for (let i = 0; i < arrMeta.length; i++) {
                  const key = arrIds[i];
                  mapMeta[key] = JSON.parse(arrMeta[i]);
                }
                const final = result.map(res =>
                  Object.assign({}, mapMeta[res.key], res),);
                resolve(final);
              });
            })();
          },
        );
      } catch (error) {
        console.error('LocationStore', 'nearby', error);
        return false;
      }
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
    try {
      const uniqueLocs = _.uniqWith(arrObj, (a, b) => a[0] === b[0]);
      const dupeCt = arrObj.length - uniqueLocs.length;
      if (uniqueLocs.length !== arrObj.length) {
        console.warn('Duplicate IDs found!', dupeCt);
      }

      const arrLocs = uniqueLocs
        .map(([id, obj]) => {
          try {
            return new Location(id, obj, obj);
          } catch (e) {
            console.warn(e);
            return false;
          }
        })
        .filter(locObj => !!locObj);

      // Redis Commands
      const arrMetaCmds = arrLocs.map(({ id, jsonString }) => [
        'set',
        id,
        jsonString,
      ]);
      const arrGeoCmds = Object.assign(...arrLocs.map(({ id, latitude, longitude }) => ({
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

      const ctMeta = results[0].filter(r => r === 'OK').length;
      const ctGeo = results[1];
      return ctMeta === ctGeo;
    } catch (error) {
      console.error('LocationStore', 'nearby', error);
      return false;
    }
  }

  /**
   * Gets locations given an array of IDs
   *
   * @param [] arrId
   * @returns Promise
   * @memberof LocationStore
   */
  async getLocBatch(arrId) {
    try {
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
    } catch (error) {
      console.error('LocationStore', 'getLocBatch', error);
      return false;
    }
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
    try {
      // Fetch meta
      const locMeta = await this.redisClient.getAsync(id);
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
    } catch (error) {
      console.error('LocationStore', 'nearby', error);
      return false;
    }
  }

  /**
   * Deletes locations given an array of IDs
   *
   * @param [] arrId
   * @returns Promise
   * @memberof LocationStore
   */
  async delLocBatch(arrId) {
    try {
      // Redis Commands
      const arrMetaCmds = arrId.map(id => ['del', id]);

      const pDelMeta = this.redisClient.multi(arrMetaCmds).execAsync();
      const pDelGeo = new Promise((resolve, reject) =>
        this.geoClient.removeLocations(arrId, (err, data) => {
          if (err) {
            return reject(err);
          }
          return resolve(data);
        }),);
      const [resMeta, resGeo] = await Promise.all([pDelMeta, pDelGeo]);
      return resMeta.length === resGeo;
    } catch (error) {
      console.error('LocationStore', 'delLocBatch', error);
      return false;
    }
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
    try {
      await this.redisClient.delAsync(id);
      return new Promise((resolve, reject) => {
        // Get location
        this.geoClient.removeLocation(id, (err, reply) => {
          if (err) {
            return reject(err);
          }
          resolve(reply);
        });
      });
    } catch (error) {
      console.error('LocationStore', 'delLoc', error);
      return false;
    }
  }

  /**
   * Flushes entire database
   *
   * @returns Promise
   * @async
   * @memberof LocationStore
   */
  async reset() {
    try {
      return this.redisClient.flushdb();
    } catch (error) {
      console.error('LocationStore', 'reset', error);
      return false;
    }
  }

  /**
   * Disconnects from Redis
   *
   * @returns Promise
   * @async
   * @memberof LocationStore
   */
  async disconnect() {
    try {
      await this.redisClient.quit();
    } catch (error) {
      console.error('LocationStore', 'disconnect', error);
      return false;
    }
  }
}

module.exports = LocationStore;
