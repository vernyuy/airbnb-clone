import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  CfnDataSource,
  CfnFunctionConfiguration,
  CfnGraphQLApi,
  CfnGraphQLSchema,
  CfnResolver,
} from "aws-cdk-lib/aws-appsync";
import * as signer from "aws-cdk-lib/aws-signer";
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Tracing } from "aws-cdk-lib/aws-lambda";
import { aws_iam } from "aws-cdk-lib";
import * as ddb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import * as appsync from "aws-cdk-lib/aws-appsync";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { bundleAppSyncResolver } from "./helpers";
import { join } from "path";
import * as sqs from  "aws-cdk-lib/aws-sqs";

interface BookingStackProps extends StackProps {
  airbnbGraphqlApi: appsync.GraphqlApi;
  // apiSchema: appsync.CfnGraphQLSchema;
  airbnbDatabase: Table;
  // airbnbTableDatasource: CfnDataSource;
}

export class BookingStacks extends Stack {
  constructor(scope: Construct, id: string, props: BookingStackProps) {
    super(scope, id, props);

    const { airbnbDatabase, airbnbGraphqlApi } =
      props;
    /**
     * Create SQS Queue and Dead letter Queue
     */

    const dlq = new sqs.Queue(this, "DeadLetterQueue");
    const queue = new sqs.Queue(this, "bookingQueue", {
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 10,
      },
    });

const lambdaRole = new Role(this, "bookingLambdaRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSAppSyncPushToCloudWatchLogs"
        ),
      ],
    });

    const bookingLambda: NodejsFunction = new NodejsFunction(
        this,
        "airbnbBookingHandler",
        {
          tracing: Tracing.ACTIVE,
          runtime: lambda.Runtime.NODEJS_16_X,
          handler: "handler",
          entry: path.join(__dirname, "lambda-fns/booking", "app.ts"),
          memorySize: 1024,
          environment:{
            BOOKING_QUEUE_URL: queue.queueUrl,
            // airbnb_DB: airbnbDatabase.tableName,
          }
        }
      );

       /**
     * Process SQS Messages Lambda
     */
    const processSQSLambda: NodejsFunction = new NodejsFunction(
        this,
        "ProcessSqSBookingHandler",
        {
          tracing: Tracing.ACTIVE,
          runtime: lambda.Runtime.NODEJS_16_X,
          handler: "handler",
          entry: path.join(
            __dirname,
            "lambda-fns/booking",
            "processSqsBooking.ts"
          ),
          memorySize: 1024,
        }
      );

      // Create a data source for the Lambda function
    const lambdaDataSource = airbnbGraphqlApi.addLambdaDataSource('lambda-data-source', bookingLambda);

    // lambdaDataSource.createResolver('query-resolver', {
    //     typeName: 'Query',
    //     fieldName: 'listNotes',
    //   });
  
      const lambdaResolver = lambdaDataSource.createResolver('mutation-resolver', {
        typeName: 'Mutation',
        fieldName: 'createApartmentBooking',
      });

    airbnbDatabase.grantWriteData(processSQSLambda);
    airbnbDatabase.grantReadData(bookingLambda);
    queue.grantSendMessages(bookingLambda);
    queue.grantConsumeMessages(processSQSLambda);
    bookingLambda.addEnvironment("airbnb_DB", airbnbDatabase.tableName);
    bookingLambda.addEnvironment("BOOKING_QUEUE_URL", queue.queueUrl);
  }
}
