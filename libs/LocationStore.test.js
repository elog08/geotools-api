const LocationStore = require('./LocationStore');
const { expect } = require('chai');
const sampleLocations = require('./data/SampleLocs.json');
const uniqid = require('uniqid');
const _ = require('lodash');

describe('Location', () => {
  let locationStore;

  before(() => {
    locationStore = new LocationStore();
  });

  it('exists', () => {
    expect(locationStore).to.be.an.instanceof(LocationStore);
  });

  describe('CRUD', () => {
    const testLoc = sampleLocations[1];
    const id = testLoc.city;

    it('adds single location', async () => locationStore.addLoc(id, testLoc));

    it('retrieves location', async () => {
      const retieved = await locationStore.getLoc(id);
      expect(retieved.id).to.equal(id);
    });

    it('deletes location', async () => {
      await locationStore.delLoc(id);
      const retrieved = await locationStore.getLoc(id);
      expect(retrieved).to.be.empty;
    });

    it('resets', async () => {
      const arrPAdds = [], 
      limit = Math.min(sampleLocations.length, 10);

      // Add some locations
      for (let i = 0; i < limit; i += 1) {
        const loc = sampleLocations[i], id = `test${i}`;
        arrPAdds.push(locationStore.addLoc(id, loc));
      }

      const added = await Promise.all(arrPAdds);
      const arrPGets = [];
      // Get the same locations
      for (let i = 0; i < limit; i += 1) {
        const id = `test${i}`;
        arrPGets.push(locationStore.getLoc(id));
      }

      const preReset = await Promise.all(arrPGets);
      expect(preReset).to.have.lengthOf(added.length);

      // Reset the DB
      await locationStore.reset();

      // Get the same locations
      for (let i = 0; i < limit; i += 1) {
        const id = `test${i}`;
        const postResetVal = await locationStore.getLoc(id);
        expect(postResetVal).to.be.empty;
      }

      // process.exit();
      // const retrieved = await locationStore.getLoc(id);
      // expect(retrieved).to.be.empty;
    });
  });

  describe('CRUD Batch', () => {
    let testLocs = sampleLocations;

    before(async () => {
      await locationStore.reset();
      testLocs = testLocs.map(testLoc => [uniqid(), testLoc]);
    });

    it('adds multiple locations', async () =>
      await locationStore.addLocBatch(testLocs));

    it('gets multiple locations by array of ids', async () => {
      const testIds = testLocs.map(([id]) => id);
      const locBatches = await locationStore.getLocBatch(testIds);
      return locBatches;
    });

    it('removes multiple locations by array of ids', async () => {
      const testIds = testLocs.map(([id]) => id);
      await locationStore.delLocBatch(testIds);
      const retrieved = await locationStore.getLocBatch(testIds);
      expect(retrieved).to.be.empty;
    });
  });

  describe('Geo Search', () => {
    let testLocs;

    before( async () => {
      await locationStore.reset();
      testLocs = sampleLocations.map(testLoc => [uniqid(), testLoc]);
      testLocs = _.shuffle(testLocs);
      return locationStore.addLocBatch(testLocs);
    });

    it('finds the nearest city for a given lat/lng', async () => {
      // Yosemite National Park in California, USA
      // Merced, CA is the closest city
      const testLatLng = { latitude: '37.863550', longitude: '-119.524658' };
      const nearLocs = await locationStore.nearby(testLatLng);
      expect(nearLocs[0].meta.city).to.equal('Merced');
    });
  });

  after(() => {
    locationStore.disconnect();
  });
});
