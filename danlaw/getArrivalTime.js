"use strict";

const _ = require("lodash");

const getRuntime = require("./runtime").getRuntime;
const init = require("./runtime").init;

module.exports.getArrivalTime = async event => {
  await init();
  const { dynamoDb } = getRuntime();

  const deviceIdParam = event.queryStringParameters.deviceId;

  const data = await dynamoDb
    .query({
      TableName: "geofence-arrival-time",
      ProjectionExpression: "#deviceId, #timest, #arrivalTimes",
      KeyConditionExpression: "#deviceId = :partitionval",
      ExpressionAttributeNames: {
        "#deviceId": "deviceId",
        "#timest": "timestamp",
        "#arrivalTimes": "arrivalTimes"
      },
      ExpressionAttributeValues: {
        ":partitionval": deviceIdParam
      },
      ScanIndexForward: false,
      Limit: 1
    })
    .promise();

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // Required for CORS support to work
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "x-api-key,content-type",
      "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
    },
    body: JSON.stringify(_.get(data, "Items[0]"))
  };
};
