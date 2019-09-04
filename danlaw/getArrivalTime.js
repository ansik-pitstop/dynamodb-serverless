"use strict";

const Promise = require("bluebird");
const AWS = require("aws-sdk");
const _ = require("lodash");

AWS.config.setPromisesDependency(Promise);

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.getArrivalTime = async event => {
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
