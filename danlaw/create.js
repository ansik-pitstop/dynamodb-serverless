"use strict";

const AWS = require("aws-sdk");
const geolib = require("geolib");
const Promise = require("bluebird");
const _ = require("lodash");
const axios = require("axios");
const moment = require("moment");
const ConfigurationLoader = require("@ansik/sdk/dist/lib/configurationLoader").ConfigurationLoader;
const configurationDefinition = require("../configurationRecords").records;

let geoLocations = null;
let conf = null;
let dynamoDb = null;

AWS.config.setPromisesDependency(Promise);

async function init() {
  let reloadConf = process.env["RELOAD"];

  if (!conf || reloadConf) {
    console.log("loading configuration");
    const configurationLoader = new ConfigurationLoader();
    const confPath = process.env["CONF_PATH"];
    if (confPath) {
      conf = await configurationLoader.loadFrom(configurationDefinition, confPath);
    } else {
      conf = configurationLoader.load(configurationDefinition);
    }
    console.log("configuration loaded");
  }

  if (reloadConf || conf.get("aws.region")) {
    AWS.config.update({ region: conf.get("aws.region") });
    console.log("aws region set: ", conf.get("aws.region"));
  }

  if (!geoLocations || reloadConf) {
    console.log("loading geolocation data");
    geoLocations = (await axios.get(conf.get("geolocationUrl"))).data.data;
    _.each(
      geoLocations,
      location =>
        (location.geofencing = _.map(location.geofencing, point => ({ latitude: point[0], longitude: point[1] })))
    );

    console.log("geolocation data loaded");
    console.log(JSON.stringify(geoLocations));
  }

  if (!dynamoDb || reloadConf) {
    console.log("create new dynamoDB instance");
    dynamoDb = new AWS.DynamoDB.DocumentClient();
    console.log("new dynamoDB instance created");
  }
}

module.exports.create = async (event, context) => {
  await init();
  const authToken = event.queryStringParameters.authToken;

  if (authToken !== conf.get("authToken")) {
    console.log(`invalid auth token: ${authToken}`);
    return {
      statusCode: 403,
      body: JSON.stringify({ result: "invalid auth token" })
    };
  }

  const timestamp = moment().unix();

  const body = JSON.parse(event.body);
  const header = body.header;

  if (!body.GpsReading) return;

  const gps = body.GpsReading;
  // console.log("header: " + JSON.stringify(event.header));
  // console.log("body: " + JSON.stringify(event.body));

  // console.log(" body timestamp: " + body.timestamp);
  // console.log(" deviceId: " + header.deviceId);
  // console.log(" eventId: " + header.eventId);
  // console.log(" ingestion timestamp : " + header.ingestionTimestamp);

  const params = {
    TableName: "gps-events",
    Item: {
      id: header.eventId,
      deviceId: header.deviceId,
      latitude: gps.latitude,
      longitude: gps.longitude,
      type: body.type,
      tripNumber: body.tripNumber,
      rawData: body,
      ingestionTimestamp: header.ingestionTimestamp,
      timestamp: body.timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  };

  if (!gps.latitude || !gps.longitude) return;

  await geoFencing(header.deviceId, gps, body.timestamp).catch(err => console.log(`error: genFencing(): ${err.stack}`));
  // await saveRecord(params);
  return {
    statusCode: 200,
    body: JSON.stringify({ result: "Item Added Successfully" })
  };
};

async function geoFencing(deviceId, location, timestamp) {
  // todo: handle the case of gps drifting?
  let lastEvent = await dynamoDb
    .query({
      TableName: "geofencing",
      ProjectionExpression: "#deviceId, #location, #type, #timest",
      KeyConditionExpression: "#deviceId = :partitionval",
      ExpressionAttributeNames: {
        "#deviceId": "deviceId",
        "#location": "location",
        "#type": "type",
        "#timest": "timestamp"
      },
      ExpressionAttributeValues: {
        ":partitionval": deviceId
      },
      ScanIndexForward: false,
      Limit: 1
    })
    .promise();

  lastEvent = _.get(lastEvent, "Items[0]") || { location: null, type: "leave" };
  console.log(`last event: ${JSON.stringify(lastEvent)}`);

  let lastEventLocation = lastEvent.location;
  let lastEventType = lastEvent.type;

  if (lastEventType === "enter") {
    await checkLeaveEvent(deviceId, location, lastEventLocation, timestamp);
  } else {
    await checkEnterEvent(deviceId, location, timestamp);
  }
}

async function checkLeaveEvent(deviceId, location, lastEventLocation, timestamp) {
  console.log("checkLeaveEvent()", deviceId, location, lastEventLocation, timestamp);
  const geofence = _.get(getGeoLocation(lastEventLocation), "geofencing");

  if (!geofence || !geolib.isPointInPolygon(location, geofence)) {
    if (!geofence) console.warn(`no geofence for ${lastEventLocation}, force create leave event to restore the state`);
    await createGeofencingEvent(deviceId, lastEventLocation, "leave", timestamp);
  }
}

async function checkEnterEvent(deviceId, location, timestamp) {
  console.log("checkEnterEvent()", deviceId, location, timestamp);
  await Promise.map(
    geoLocations,
    async geolocation => {
      console.log("geolocation: ", geolocation);

      if (!geolocation.geofencing) {
        console.warn(`location has no geofencing: ${geolocation.label}`);
        return;
      }

      if (geolib.isPointInPolygon(location, geolocation.geofencing)) {
        await createGeofencingEvent(deviceId, geolocation.label, "enter", timestamp);
      }
    },
    { concurrency: 3 }
  );
}

function getGeoLocation(label) {
  return _.find(geoLocations, { label });
}

async function createGeofencingEvent(deviceId, location, type, timestamp) {
  console.log(`createGeofencingEvent(): ${deviceId}, ${location}, ${type}, ${timestamp}`);
  // await saveRecord({
  //   TableName: "geofencing",
  //   Item: {
  //     deviceId: deviceId,
  //     location: location,
  //     type: type,
  //     timestamp: timestamp
  //   }
  // });
  await updateArrivalTime(deviceId, location, type, timestamp);
}

async function updateArrivalTime(deviceId, location, type, timestamp) {
  console.log(`updateArrivalTime(): ${deviceId}, ${location}, ${type}, ${timestamp}`);
  const googleMapsClient = require("@google/maps").createClient({
    key: conf.get("googleApiKey"),
    Promise: Promise
  });

  console.log("fetching arrival times");

  const candidates = geoLocations;

  const now = moment();

  const distanceMatrixResponse = await googleMapsClient
    .distanceMatrix({
      origins: [location],
      destinations: candidates,
      mode: "driving"
    })
    .asPromise();

  const arrivalTimes = _.chain(distanceMatrixResponse)
    .get("json.rows[0].elements")
    .map((item, index) => {
      const label = _.get(candidates, `[${index}].label`);
      const arrivalTimestamp = moment(now).add(_.get(item, "duration.value"), "second");

      if (!label || !arrivalTimestamp.isValid()) return undefined;

      return {
        label,
        arrivalTimestamp: arrivalTimestamp.toISOString()
      };
    })
    .compact()
    .value();

  console.log("arrivalTimes: ", arrivalTimes);

  await saveRecord({
    TableName: "geofence-arrival-time",
    Item: {
      deviceId,
      timestamp: now.toISOString(),
      arrivalTimes: arrivalTimes
    }
  });

  console.log("arrival times updated");
}

async function saveRecord(params) {
  await dynamoDb.put(params).promise();
}
