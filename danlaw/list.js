'use strict';

const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();


module.exports.list = (event,context, callback) => {
  var deviceIdParam = "";
  deviceIdParam = event.queryStringParameters.deviceId;

  const params = {
    "TableName": 'gps-events',
    "ProjectionExpression": "#deviceId, #latitude, #longitude, #timest",
    "KeyConditionExpression": "#deviceId = :partitionval",
    "ExpressionAttributeNames": {
      "#deviceId": "deviceId",
      "#latitude": "latitude",
      "#longitude": "longitude",
      "#timest": "timestamp"
    },
    "ExpressionAttributeValues": {
      ":partitionval": deviceIdParam
    },
    ScanIndexForward: false,
    "Limit": 50
  }

  
  dynamoDb.query(params, (error, result) => {
    if(error) {
      console.error(error);
      callback(new Error('Could not fetch the events from the table'));
      return;
    }
    
    const response = {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
        "Access-Control-Allow-Methods":"GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "x-api-key,content-type",
        "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS 
      },
      body: JSON.stringify(result)
    }
    callback(null, response);
  });
}