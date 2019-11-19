const Promise = require("bluebird");
const AWS = require("aws-sdk");
const axios = require("axios");
const _ = require("lodash");

const ConfigurationLoader = require("@ansik/sdk/dist/lib/configurationLoader").ConfigurationLoader;
const configurationDefinition = require("../configurationRecords").records;

let geoLocations = null;
let conf = null;
let dynamoDb = null;

AWS.config.setPromisesDependency(Promise);

module.exports.init = async () => {
  global.Promise = Promise;

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
};

module.exports.getRuntime = () => ({ conf, geoLocations, dynamoDb });
