"use strict";

const getRuntime = require("./runtime").getRuntime;
const init = require("./runtime").init;

module.exports.list = async event => {
  await init();

  const { dynamoDb } = getRuntime();

  const deviceIdParam = event.queryStringParameters.deviceId;

  const queryResult = await Promise.all([
    dynamoDb
      .query({
        TableName: "gps-events",
        Region: "us-east-1",
        ProjectionExpression: "#deviceId, #latitude, #longitude, #timest",
        KeyConditionExpression: "#deviceId = :partitionval",
        ExpressionAttributeNames: {
          "#deviceId": "deviceId",
          "#latitude": "latitude",
          "#longitude": "longitude",
          "#timest": "timestamp"
        },
        ExpressionAttributeValues: {
          ":partitionval": deviceIdParam
        },
        ScanIndexForward: false,
        Limit: 50
      })
      .promise(),
    dynamoDb
      .query({
        TableName: "geofencing",
        Region: "us-east-1",
        ProjectionExpression: "#deviceId, #location, #type, #timest",
        KeyConditionExpression: "#deviceId = :partitionval",
        ExpressionAttributeNames: {
          "#deviceId": "deviceId",
          "#location": "location",
          "#type": "type",
          "#timest": "timestamp"
        },
        ExpressionAttributeValues: {
          ":partitionval": deviceIdParam
        },
        ScanIndexForward: false,
        Limit: 1
      })
      .promise()
      .catch(err => {
        console.log(err);
      })
  ]).spread((vehicleData, lastGeofencingEvent) => ({
    vehicleData,
    lastGeofencingEvent
  }));

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // Required for CORS support to work
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "x-api-key,content-type",
      "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
    },
    body: JSON.stringify(queryResult)
  };
};
