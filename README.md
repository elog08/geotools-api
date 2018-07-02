![alt text](https://travis-ci.org/elog08/geotools-api.svg?branch=master)
![alt text](https://raw.githubusercontent.com/elog08/geotools-api/master/logo.png)
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

Using Fake Redis
```
npm test 
```

Using a local Redis
```
npm run test-redis
```

## Deployment

### via Docker Compose

1. Install Docker Compose
2. Customize port in docker-compose.yml
3. `docker-compose build && docker-compose-up`

### via Plain Docker

```
docker run --name gtapi-redis -d redis
docker run --name gtapi-web --link gtapi-redis:redis -p 8080:8080 -d elog08/gtapi:latest
```

### Build your own image

Build a local image

```
docker build -t yourhandle/gtapi
```

## Usage

The web service accepts the following query strings on 

`GET /`

`latitude`, `longitude` - required
`distance` - distance in meters
`count` - maximum number of results to return

Sample request:

```
curl http://localhost:8080/?latitude=37.7749&longitude=122.4194&count=1
```

Response:
```
{
   "success":true,
   "result":[
      {
         "id":"cn_shn_wh",
         "latitude":37.49997072,
         "longitude":122.0999784,
         "meta":{
            "city":"Weihai",
            "city_ascii":"Weihai",
            "latitude":37.49997072,
            "longitude":122.0999784,
            "pop":356425,
            "country":"China",
            "country_code":"CN",
            "iso3":"CHN",
            "state":"Shandong"
         },
         "key":"cn_shn_wh",
         "distance":41552.7934
      }
   ]
}
```

`GET /_dump`

Returns the entire DB. 
*Warning* This is a very expensive operation and will block other requests.

```
{
   "success":true,
   "result":[
      {...}
    ]
}
```

no paramaters requires

Sample request:

```
curl http://localhost:8080/_bulk
```


## Built With

* [ExpressJS](https://github.com/expressjs/express) - The web framework used
* [GeoRedis](https://github.com/arjunmehta/node-georedis) - Redis-based Location Management

## Contributing
Use these guidelines: https://gist.github.com/PurpleBooth/b24679402957c63ec426

## Authors

* **Eyasu Kifle** - *Initial work* - [elog08](https://github.com/elog08)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
