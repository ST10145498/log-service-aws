/**
 * CDK Stack Definition
 * 
 * This file defines all AWS infrastructure as code:
 * - DynamoDB table with Global Secondary Index
 * - Two Lambda functions (Ingest and ReadRecent)
 * - Lambda Function URLs (API endpoints)
 * - IAM permissions
 * 
 * CDK will automatically create all these resources in AWS when deployed.
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';

export class LogServiceAwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * DynamoDB Table Definition
     * 
     * Design decisions:
     * - Partition Key (logId): Distributes writes evenly across partitions
     * - Sort Key (timestamp): Enables efficient time-based queries
     * - GSI (Global Secondary Index): Allows querying all logs sorted by time
     * - On-demand billing: Pay only for what you use, auto-scales
     * - RemovalPolicy.DESTROY: Table deleted when stack is destroyed (dev/test only)
     */
    const table = new dynamodb.Table(this, 'LogEntriesTable', {
      partitionKey: {
        name: 'logId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: 'LogEntries',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /**
     * Global Secondary Index (GSI)
     * 
     * Why we need this:
     * - Primary key (logId) is random, can't query "all logs by time"
     * - GSI with logType as partition key groups all logs together
     * - timestamp as sort key enables efficient time-based queries
     * - Allows "get 100 most recent logs" query to be fast and efficient
     */
    table.addGlobalSecondaryIndex({
      indexName: 'TimestampIndex',
      partitionKey: {
        name: 'logType',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    /**
     * Ingest Lambda Function
     * 
     * This function receives HTTP POST requests and stores log entries.
     * 
     * Configuration:
     * - Runtime: Node.js 20 (latest LTS)
     * - Handler: index.handler (exported handler function)
     * - Timeout: 30 seconds (generous for DynamoDB writes)
     * - Memory: 256 MB (sufficient for JSON processing)
     * - Bundling: esbuild compiles TypeScript to JavaScript locally
     */
    const ingestLambda = new nodejs.NodejsFunction(this, 'IngestFunction', {
      entry: 'src/lambdas/ingest/index.ts',
      functionName: 'LogService-Ingest',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    /**
     * ReadRecent Lambda Function
     * 
     * This function retrieves the 100 most recent log entries.
     * Queries DynamoDB using the GSI for efficient time-based retrieval.
     */
    const readRecentLambda = new nodejs.NodejsFunction(this, 'ReadRecentFunction', {
      entry: 'src/lambdas/read-recent/index.ts',
      functionName: 'LogService-ReadRecent',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        GSI_NAME: 'TimestampIndex',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
      },
    });

    /**
     * IAM Permissions
     * 
     * Grant Lambda functions permission to access DynamoDB.
     * CDK automatically creates IAM roles with least-privilege policies.
     * 
     * - Ingest needs: PutItem permission
     * - ReadRecent needs: Query permission on table and GSI
     */
    table.grantWriteData(ingestLambda);
    table.grantReadData(readRecentLambda);

    /**
     * Lambda Function URLs
     * 
     * Creates public HTTPS endpoints for the Lambda functions.
     * These act as simple APIs without needing API Gateway.
     * 
     * - authType: NONE means publicly accessible (no authentication)
     * - For production, add authentication (IAM, Cognito, or Lambda authorizer)
     * - CORS enabled to allow browser-based clients
     */
    const ingestUrl = ingestLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['Content-Type'],
      },
    });

    const readRecentUrl = readRecentLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.GET],
        allowedHeaders: ['Content-Type'],
      },
    });

    /**
     * CloudFormation Outputs
     * 
     * These values are displayed after deployment.
     * Users need these URLs to test the APIs.
     */
    new cdk.CfnOutput(this, 'IngestLambdaUrl', {
      value: ingestUrl.url,
      description: 'URL for Ingest Lambda (POST to create logs)',
    });

    new cdk.CfnOutput(this, 'ReadRecentLambdaUrl', {
      value: readRecentUrl.url,
      description: 'URL for ReadRecent Lambda (GET to retrieve logs)',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      description: 'DynamoDB table name',
    });
  }
}