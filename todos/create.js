'use strict';

const AWS = require('aws-sdk');
const uuid = require('uuid');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.create = (event, context, callback) => {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);

  if (typeof data.text !== 'string') {
    console.error('Validation Failed');
    callback(new Error('could not create the todo item'))
    return;
  }

  const params = {
    TableName: 'todos',
    Item: {
      id: uuid.v1(),
      text: data.text,
      checked: false,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  }
  
  dynamoDb.put(params, (error, result) => {
    if(error) {
      console.log(error);
      callback(new Error('could not create a todo item'));
    }
    const response = {
      statusCode: 200,
      body: JSON.stringify(result)
    }
    callback(null, response);
  })
}
