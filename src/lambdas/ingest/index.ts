/**
 * Ingest Lambda Function
 * 
 * Receives log entries via HTTP POST and stores them in DynamoDB.
 * This Lambda is exposed via a Function URL (acts as a simple API endpoint).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
const { v4: uuidv4 } = require('uuid');
import { validateLogInput } from '../../utils/validator';
import { CreateLogInput, CreateLogResponse, LogEntry } from '../../models/log-entry';

// Initialize DynamoDB client
// Uses environment variables for configuration (table name, region)
const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

// Table name comes from environment variable set by CDK
const TABLE_NAME = process.env.TABLE_NAME || '';

/**
 * Lambda handler function
 * 
 * Flow:
 * 1. Parse incoming HTTP request
 * 2. Validate input
 * 3. Generate ID and timestamp
 * 4. Store in DynamoDB
 * 5. Return success response
 * 
 * @param event - Lambda function URL event containing HTTP request data
 */
export const handler = async (event: any): Promise<any> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    // Function URL passes body as a string, so we parse it to JSON
    let body: CreateLogInput;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Invalid JSON in request body'
        })
      };
    }

    // Validate input
    // Ensures severity and message meet requirements before processing
    const validation = validateLogInput(body);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: validation.error
        })
      };
    }

    // Create log entry with generated fields
    // Server generates ID and timestamp to ensure consistency
    const logEntry: LogEntry = {
      logId: uuidv4(), // Generate unique ID
      timestamp: new Date().toISOString(), // Current time in ISO format
      severity: body.severity,
      message: body.message,
      logType: 'LOG' // Constant for GSI queries
    };

    // Store in DynamoDB
    await dynamoDB.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: logEntry
    }));

    console.log('Successfully stored log entry:', logEntry.logId);

    // Return success response
    const response: CreateLogResponse = {
      success: true,
      logId: logEntry.logId,
      timestamp: logEntry.timestamp
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };

  } catch (error) {
    // Handle unexpected errors
    console.error('Error processing request:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error'
      })
    };
  }
};