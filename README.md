![alt text](https://api.travis-ci.org/elog08/geotools-api-nearestbigcity.svg?branch=master)

# GeoTools API - Big City Look Up API
A micro web service that finds the nearest prominent city for a given set of coordinates.

Uses a JSON version of the free data set from here: 
https://simplemaps.com/data/world-cities

It has about 7300 cities.
You can purchase the comprehensive version for more entries.

## Getting Started
You can either run the service as a Docker component or as a node service.

### Prerequisites

* NodeJS > 8
* A Redis Server

### Installing

Standard Node procedures:

```
git clone https://github.com/elog08/geotools-api-nearestbigcity
cd geotools-api-nearestbigcity
npm install
```

After installing, you need to seed your database with the JSON

```
npm run importData.js
```

Make sure you have redis running and run

```
npm start
```
## Running the tests

```
npm test
```

## Deployment


### Initialize Redis

```
docker run --name gtapi-redis -d redis
```

### Use the Docker Hub version
```
docker run --link gtapi-redis:redis -p 8080:8080 -d elog08/gtapi-nearestbc
```

### Build your own image

Build a local image

```
docker build -t <handle>/gtapi-nearestbc
```


## Built With

* [ExpressJS](https://github.com/expressjs/express) - The web framework used
* [GeoRedis](https://github.com/arjunmehta/node-georedis) - Redis-based Location Management

## Contributing
Use these guidelines: https://gist.github.com/PurpleBooth/b24679402957c63ec426

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/your/project/tags

## Authors

* **Eyasu Kifle** - *Initial work* - [elog08](https://github.com/elog08)


## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
