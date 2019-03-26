'use strict';

const AWS = require('aws-sdk');
const moment = require('moment');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.create = (event, context, callback) => {
  
  // console.log("authki");
  // console.log("OYE BC 2:  " + JSON.stringify(event));

  console.log("auth ki tokenasdfasdf" + event.queryStringParameters.authToken);
  var authToken = "check";
  authToken = event.queryStringParameters.authToken;
  if(authToken !== "A41vqMEgpezEIdHh9ePCIBlGeXoYL1lu") {
    const response = {
      statusCode: 403,
      body: JSON.stringify({"result": "forbidden"})
    }
    callback(null, response);
  } 
  else {
    const timestamp = new Date().getTime();
    // const body = JSON.parse(event.body);
    var header;
    var body;

    if(event && event.body) {
      body = JSON.parse(event.body);
      header = body.header;
    }

    if(body.GpsReading) {
      var gps = body.GpsReading;
      // console.log("header: " + JSON.stringify(event.header));
      // console.log("body: " + JSON.stringify(event.body));

      // console.log(" body timestamp: " + body.timestamp);
      // console.log(" deviceId: " + header.deviceId);
      // console.log(" eventId: " + header.eventId);
      // console.log(" ingestion timestamp : " + header.ingestionTimestamp);
      
      const params = {
        TableName: 'gps-events',
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
      }
      
      if(gps.latitude && gps.longitude) {
          
        dynamoDb.put(params, (error, result) => {
          if(error) {
            console.log(error);
            callback(new Error('could not create a todo item'));
          }
          const response = {
            statusCode: 200,
            body: JSON.stringify({"result": "Item Added Successfully"})
          }
          callback(null, response);
        });
      }
    }

    if (body.postman) {
    
      var i = 0;

      // setInterval(function(){  
        var route = [[43.61724,-79.53926],[43.61777,-79.54087],[43.6218,-79.5426], [43.62248,-79.5406], [43.62282,-79.54074],[43.62773,-79.54287], [43.63002,-79.54348], [43.63121,-79.54383], [43.63158,-79.54432], [43.63202,-79.54458],[43.63214,-79.54451], [43.6368, -79.53946], [43.63853,-79.53799], [43.63645,-79.53746], [43.63658, -79.53764], [43.63674, -79.53794], [43.63695,-79.53798], [43.63719, -79.53781]];
        var routeSize = route.length;
    
        if(i == routeSize) {
          i = 0;
        }
        i ++; 
        dynamoDb.put(params, (error, result) => {
          if(error) {
            console.log(error);
            callback(new Error('could not create a todo item'));
            return;
          }
          const response = {
            statusCode: 200,
            body: JSON.stringify(result)
          }
          callback(null, response);
        });
    } 
  }
}
  

 





