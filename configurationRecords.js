module.exports.records =
  /**
   *
   * @type {ConfigurationEntryLoadOptions[]}
   */
  [
    { destPath: "authToken", isRequired: true },
    { destPath: "geolocationUrl", isRequired: true },
    { destPath: "aws.region" },
    { destPath: "googleApiKey", isRequired: true }
  ];
