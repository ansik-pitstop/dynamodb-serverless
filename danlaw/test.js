const config = require('config');
const path = config.globalConfig.path;
const l = require('lodash');
const logger = require(path._to('logger'));
const promise = require('bluebird');
const PubNub = require('pubnub')
const moment = require('moment');

module.exports = {
  particleWebHookHandler: particleWebHookHandler
};

function isJson(item) {
  item = typeof item !== "string"
      ? JSON.stringify(item)
      : item;

  try {
      item = JSON.parse(item);
  } catch (e) {
      return false;
  }

  if (typeof item === "object" && item !== null) {
      return true;
  }

  return false;
}

function particleWebHookHandler(req, res) {
  var pubnub = new PubNub({
    subscribeKey: "sub-c-c83a56b6-a196-11e8-864c-5ad855a31a2a",
    publishKey: "pub-c-11140399-035f-4ced-878a-73cd076725c5",
    // secretKey: "sec-c-YmUxMWJjODItYWNlYy00OTRlLTk2MjctN2Y0MGQxODE1MGFl",
    // ssl: true
  });

  var channel = 'pubnub-mapbox';

  var events = req.body;

  var i = 0;

  if(req.body.postman) {

    setInterval(function(){
      
      var route = [[43.61724,-79.53926],[43.61777,-79.54087],[43.6218,-79.5426], [43.62248,-79.5406], [43.62282,-79.54074],[43.62773,-79.54287], [43.63002,-79.54348], [43.63121,-79.54383], [43.63158,-79.54432], [43.63202,-79.54458],[43.63214,-79.54451], [43.6368, -79.53946], [43.63853,-79.53799], [43.63645,-79.53746], [43.63658, -79.53764], [43.63674, -79.53794], [43.63695,-79.53798], [43.63719, -79.53781]];
      var routeSize = route.length;
  
      var index = i % routeSize;
      if(i == routeSize) {
        i = 0;
      }
      i ++; 

      var new_point = {};
      new_point['latlng'] = [
        route[index][0], route[index][1]
      ];
      var now = moment(Date.now()).utcOffset(-4).format('ddd - hh:mm a')
      new_point['lastSeen'] = [now];

      pubnub.publish({
        channel: channel,
        message: [new_point]
      }, function (status, response) {
          if (status.error) {
              // handle error
              console.log("in the error !!!1")
              console.log(status)
          } else {
              console.log("message Published w/ timetoken", response.timetoken)
          }
      });

    }, 5000);
  }

  if(req.body.GpsReading) {
    console.log("header: " + JSON.stringify(req.header));
    console.log("body: " + JSON.stringify(req.body));

    console.log(" body timestamp: " + req.body.timestamp);
    console.log(" deviceId: " + req.body.header.deviceId);
    console.log(" eventId: " + req.body.header.eventId);
    console.log(" ingestion timestamp : " + req.body.header.ingestionTimestamp);

    var gps = req.body.GpsReading;
    if(gps.latitude && gps.longitude) {
      var new_point = {};
      new_point['latlng'] = [
        gps.latitude, gps.longitude
      ];
      if(req.body.timestamp) {
        var now = moment(req.body.timestamp).format('ddd - hh:mm a');
        new_point['lastSeen'] = [now];
      }
      pubnub.publish({
        channel: channel,
        message: [new_point]
      }, function (status, response) {
        if (status.error) {
          // handle error
          console.log("in the error !!!1")
          console.log(status)
        } else {
          console.log("message Published w/ timetoken", response.timetoken)
        }
      });
    }
  }

  // if(isJson(req.body.data)) {
  //   jsonData = JSON.parse(req.body.data);
  
  //   console.log(jsonData);
  //   var new_point = {};
  //   if(jsonData.lat && jsonData.lon) {
  //     new_point['latlng'] = [
  //       jsonData.lat, jsonData.lon
  //     ];
  //     pubnub.publish({
  //     channel: channel,
  //     message: [new_point]
  //   }, function (status, response) {
  //       if (status.error) {
  //           // handle error
  //           console.log("in the error !!!1")
  //           console.log(status)
  //       } else {
  //           console.log("message Published w/ timetoken", response.timetoken)
  //       }
  //     });
  //   }
  // }
  res.json({msg: "hello"}); 
}
