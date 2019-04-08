"use strict";

const AWS = require("aws-sdk");
const moment = require("moment");
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const geolib = require("geolib");
const Promise = require("bluebird");
const _ = require("lodash");

/**
 * global constants
 */
const KiplingPolygon = convertPolygon({
  coordinates: [
    [43.63603, -79.533561],
    [43.635882, -79.534778],
    [43.636632, -79.535995],
    [43.637785, -79.534637],
    [43.637669, -79.533963]
  ]
});

/**
 * global constants
 */
const IkeaPolygon = convertPolygon({
  coordinates: [
    [43.618794, -79.536233],
    [43.619387, -79.533209],
    [43.617098, -79.532303],
    [43.616507, -79.535311]
  ]
});

AWS.config.setPromisesDependency(Promise);

module.exports.create = (event, context, callback) => {
  // console.log("authki");
  // console.log("OYE BC 2:  " + JSON.stringify(event));

  console.log("auth ki tokenasdfasdf" + event.queryStringParameters.authToken);
  var authToken = "check";
  authToken = event.queryStringParameters.authToken;
  if (authToken !== "A41vqMEgpezEIdHh9ePCIBlGeXoYL1lu") {
    const response = {
      statusCode: 403,
      body: JSON.stringify({ result: "forbidden" })
    };
    callback(null, response);
  } else {
    const timestamp = new Date().getTime();
    // const body = JSON.parse(event.body);
    var header;
    var body;

    if (event && event.body) {
      body = JSON.parse(event.body);
      header = body.header;
    }

    if (body.GpsReading) {
      var gps = body.GpsReading;
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

      if (gps.latitude && gps.longitude) {
        geoFencing(header.deviceId, gps, body.timestamp).catch(err =>
          console.log(`error: genFencing(): ${err.stack}`)
        );

        dynamoDb.put(params, (error, result) => {
          if (error) {
            console.log(error);
            callback(new Error("could not create a todo item"));
          }
          const response = {
            statusCode: 200,
            body: JSON.stringify({ result: "Item Added Successfully" })
          };
          callback(null, response);
        });
      }
    }

    if (body.postman) {
      var i = 0;

      // setInterval(function(){
      var route = [
        [43.61724, -79.53926],
        [43.61777, -79.54087],
        [43.6218, -79.5426],
        [43.62248, -79.5406],
        [43.62282, -79.54074],
        [43.62773, -79.54287],
        [43.63002, -79.54348],
        [43.63121, -79.54383],
        [43.63158, -79.54432],
        [43.63202, -79.54458],
        [43.63214, -79.54451],
        [43.6368, -79.53946],
        [43.63853, -79.53799],
        [43.63645, -79.53746],
        [43.63658, -79.53764],
        [43.63674, -79.53794],
        [43.63695, -79.53798],
        [43.63719, -79.53781]
      ];
      var routeSize = route.length;

      if (i == routeSize) {
        i = 0;
      }
      i++;
      dynamoDb.put(params, (error, result) => {
        if (error) {
          console.log(error);
          callback(new Error("could not create a todo item"));
          return;
        }
        const response = {
          statusCode: 200,
          body: JSON.stringify(result)
        };
        callback(null, response);
      });
    }
  }
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

  console.log(JSON.stringify(lastEvent));

  lastEvent = _.defaultsDeep(_.get(lastEvent, "Items[0]"), {
    location: null,
    type: "leave"
  });

  let lastEventLocation = lastEvent.location;
  let lastEventType = lastEvent.type;

  console.log(`lastEvent: ${JSON.stringify(lastEvent)}`);

  if (!lastEventLocation) {
    await checkEnterIkea(deviceId, location, timestamp);
    await checkEnterKipling(deviceId, location, timestamp);
  } else if (lastEventLocation === "kipling" && lastEventType === "enter") {
    await checkLeaveKipling(deviceId, location, timestamp);
  } else if (lastEventLocation === "kipling" && lastEventType === "leave") {
    await checkEnterIkea(deviceId, location, timestamp);
  } else if (lastEventLocation === "ikea" && lastEventType === "enter") {
    await checkLeaveIkea(deviceId, location, timestamp);
  } else if (lastEventLocation === "ikea" && lastEventType === "leave") {
    await checkEnterKipling(deviceId, location, timestamp);
  } else {
    console.log(
      `invalid state: location: ${lastEventLocation}, type: ${lastEventType}`
    );
  }
}

async function checkEnterKipling(deviceId, location, timestamp) {
  console.log(
    `checkEnteringKipling(): ${deviceId}, ${JSON.stringify(
      location
    )}, ${timestamp}`
  );
  if (geolib.isPointInside(location, KiplingPolygon)) {
    return createGeofencingEvent(deviceId, "kipling", "enter", timestamp);
  }
}
async function checkLeaveKipling(deviceId, location, timestamp) {
  console.log(
    `checkLeaveKipling(): ${deviceId}, ${JSON.stringify(
      location
    )}, ${timestamp}`
  );
  if (!geolib.isPointInside(location, KiplingPolygon)) {
    return createGeofencingEvent(deviceId, "kipling", "leave", timestamp);
  }
}
async function checkEnterIkea(deviceId, location, timestamp) {
  console.log(
    `checkEnterIkea(): ${deviceId}, ${JSON.stringify(location)}, ${timestamp}`
  );
  if (geolib.isPointInside(location, IkeaPolygon)) {
    return createGeofencingEvent(deviceId, "ikea", "enter", timestamp);
  }
}
async function checkLeaveIkea(deviceId, location, timestamp) {
  console.log(
    `checkLeaveIkea(): ${deviceId}, ${JSON.stringify(location)}, ${timestamp}`
  );
  if (!geolib.isPointInside(location, IkeaPolygon)) {
    return createGeofencingEvent(deviceId, "ikea", "leave", timestamp);
  }
}

function convertPolygon(polygon) {
  return _.map(polygon.coordinates, point => ({
    latitude: point[0],
    longitude: point[1]
  }));
}

async function createGeofencingEvent(deviceId, location, type, timestamp) {
  console.log(
    `createGeofencingEvent(): ${deviceId}, ${location}, ${type}, ${timestamp}`
  );
  return dynamoDb
    .put({
      TableName: "geofencing",
      Item: {
        deviceId: deviceId,
        location: location,
        type: type,
        timestamp: timestamp
      }
    })
    .promise();
}

console.log(
  geolib.isPointInside(
    { latitude: 43.61883, longitude: -79.53328 },
    IkeaPolygon
  )
);
