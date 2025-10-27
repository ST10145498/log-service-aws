 
/**
 * ReadRecent Lambda Function
 * 
 * Retrieves the 100 most recent log entries from DynamoDB.
 * Uses a Global Secondary Index (GSI) to efficiently query by timestamp.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ReadRecentResponse, LogEntry } from '../../models/log-entry';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

// Environment variables set by CDK during deployment
const TABLE_NAME = process.env.TABLE_NAME || '';
const GSI_NAME = process.env.GSI_NAME || '';

/**
 * Lambda handler function
 * 
 * Flow:
 * 1. Query DynamoDB using GSI
 * 2. Sort by timestamp descending (newest first)
 * 3. Limit to 100 results
 * 4. Return formatted response
 * 
 * @param event - Lambda function URL event
 */
export const handler = async (event: any): Promise<any> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    // Query DynamoDB using the Global Secondary Index
    // GSI allows us to query all logs sorted by timestamp efficiently
    const result = await dynamoDB.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI_NAME,
      // Query for all logs (logType = 'LOG')
      KeyConditionExpression: 'logType = :logType',
      ExpressionAttributeValues: {
        ':logType': 'LOG'
      },
      // Sort by timestamp descending (newest first)
      // ScanIndexForward: false means descending order
      ScanIndexForward: false,
      // Limit to 100 most recent entries as per requirements
      Limit: 100
    }));

    // Extract log entries from DynamoDB result
    // Items is undefined if no results, so default to empty array
    const logs = (result.Items || []) as LogEntry[];

    console.log(`Retrieved ${logs.length} log entries`);

    // Format response according to our interface
    const response: ReadRecentResponse = {
      count: logs.length,
      logs: logs
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };

  } catch (error) {
    // Handle unexpected errors
    console.error('Error retrieving logs:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count: 0,
        logs: [],
        error: 'Internal server error'
      })
    };
  }
};
