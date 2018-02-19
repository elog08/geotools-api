const LocationStore = require('./LocationStore');
const { expect } = require('chai');
const sampleLocations = require('./data/SampleLocs.json');
const uniqid = require('uniqid');

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
  });

  describe('CRUD Batch', () => {
    let testLocs = sampleLocations;

    before(() => {
      testLocs = testLocs.map((testLoc) => [uniqid(), testLoc]);
    });

    it('adds multiple locations', async () => await locationStore.addLocBatch(testLocs));

    it('gets multiple locations by array of ids', async () => {
      const testIds = testLocs.map(([id]) => id);
      return await locationStore.getLocBatch(testIds);
    });

    it('removes multiple locations by array of ids', async () => {
      const testIds = testLocs.map(([id]) => id);
      await locationStore.delLocBatch(testIds);
      const retrieved = await locationStore.getLocBatch(testIds);
      expect(retrieved).to.be.empty;
    });
  });

  after(() => {
    locationStore.disconnect();
  });
});
