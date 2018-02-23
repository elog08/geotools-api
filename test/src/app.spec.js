const chai = require('chai');
const request = require('supertest');
const uniqid = require('uniqid');

const app = require('../../src/app');
const sampleLocs = require('../data/SampleLocs.json');

const expect = chai.expect;

describe('Web Service', function() {
  let testLocs;
  this.timeout(10000);
  before(async () => {
    try {
      await app.initialize();
      await app.store.reset();
      testLocs = sampleLocs.map(testLoc => [uniqid(), testLoc]);
      await app.store.addLocBatch(testLocs);
    } catch (e) {
      console.error('API Test Error', e);
      return false;
    }
  });

  it('should invalidate if no paramaters are provided', (done) => {
    request(app)
      .get('/')
      .end((err, res) => {
        expect(res.body.success).to.be.false;
        expect(res.statusCode).to.be.equal(400);
        done();
      });
  });

  it('should return results for a valid request', (done) => {
    const latitude = '36.1699',
      longitude = '-115.1398';
    request(app)
      .get('/')
      .query({ latitude, longitude })
      .end((err, res) => {
        expect(res.body.success).to.be.true;
        expect(res.body.result).to.be.a('array');
        expect(res.statusCode).to.be.equal(200);
        done();
      });
  });

  it('should filter by distance', (done) => {
    const latitude = '36.1699',
      longitude = '-115.1398',
      distance = '5000';

    request(app)
      .get('/')
      .query({ latitude, longitude, distance })
      .end((err, res) => {
        expect(res.body.success).to.be.true;
        expect(res.body.result).to.be.a('array');
        expect(res.body.result).to.have.lengthOf(1);
        expect(res.body.result[0].meta.city).to.equal('Las Vegas');
        expect(res.statusCode).to.be.equal(200);
        done();
      });
  });

  it('should limit results by count', (done) => {
    const latitude = '36.1699',
      longitude = '-115.1398',
      distance = '5000000',
      count = '25';

    request(app)
      .get('/')
      .query({
        latitude,
        longitude,
        distance,
        count,
      })
      .end((err, res) => {
        expect(res.body.success).to.be.true;
        expect(res.body.result).to.be.a('array');
        expect(res.body.result).to.have.lengthOf(25);
        expect(res.body.result[0].meta.city).to.equal('Las Vegas');
        expect(res.statusCode).to.be.equal(200);
        done();
      });
  });

  after(() => {
    app.shutdown();
  });
});
