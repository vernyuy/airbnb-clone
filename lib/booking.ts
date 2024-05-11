//
import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Tracing } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as appsync from "aws-cdk-lib/aws-appsync";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { bundleAppSyncResolver } from "./helpers";
import { join } from "path";
import * as sqs from "aws-cdk-lib/aws-sqs";
import {
  DynamoEventSource,
  SqsEventSource,
} from "aws-cdk-lib/aws-lambda-event-sources";

interface BookingStackProps extends StackProps {
  airbnbGraphqlApi: appsync.GraphqlApi;
  airbnbDatabase: Table;
}

export class Booking extends Stack {
  constructor(scope: Construct, id: string, props: BookingStackProps) {
    super(scope, id, props);

    const { airbnbDatabase, airbnbGraphqlApi } = props;
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

    const sqsPoolFn = new lambda.Function(this, "sqs-lambda", {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "processSqsBooking.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda-fns/booking")),
      environment: {
        TABLE_NAME: airbnbDatabase.tableName,
        QUEUE_URL: queue.queueUrl,
      },
    });

    sqsPoolFn.addEventSource(new SqsEventSource(queue));

    const ddbConsumer = new lambda.Function(this, "ddb-lambda", {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "ddbConsumer.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda-fns/booking")),
      environment: {
        TABLE_NAME: airbnbDatabase.tableName,
        QUEUE_URL: queue.queueUrl,
      },
    });

    ddbConsumer.addEventSource(
      new DynamoEventSource(airbnbDatabase, {
        startingPosition: lambda.StartingPosition.LATEST,
      })
    );

    airbnbDatabase.grantStreamRead(ddbConsumer);
    airbnbDatabase.grantReadWriteData(sqsPoolFn);
    queue.grantSendMessages(ddbConsumer);
    queue.grantConsumeMessages(sqsPoolFn);

    const createBookingFunction = new appsync.AppsyncFunction(
      this,
      "createBooking",
      {
        name: "createBooking",
        api: airbnbGraphqlApi,
        dataSource: airbnbGraphqlApi.addDynamoDbDataSource(
          "airbnbBookingDataSource",
          airbnbDatabase
        ),
        code: bundleAppSyncResolver("src/resolvers/booking/createBooking.ts"),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      }
    );

    new appsync.Resolver(this, "createBookingResolver", {
      api: airbnbGraphqlApi,
      typeName: "Mutation",
      fieldName: "createApartmentBooking",
      code: appsync.Code.fromAsset(
        join(__dirname, "./js_resolvers/_before_and_after_mapping_template.js")
      ),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [createBookingFunction],
    });

    //   const lambdaRole = new Role(this, "bookingLambdaRole", {
    //         assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    //         managedPolicies: [
    //           ManagedPolicy.fromAwsManagedPolicyName(
    //             "service-role/AWSAppSyncPushToCloudWatchLogs"
    //           ),
    //         ],
    //       });

    //       const bookingLambda: NodejsFunction = new NodejsFunction(
    //           this,
    //           "airbnbBookingHandler",
    //           {
    //             tracing: Tracing.ACTIVE,
    //             runtime: lambda.Runtime.NODEJS_16_X,
    //             handler: "handler",
    //             entry: path.join(__dirname, "lambda-fns/booking", "app.ts"),
    //             memorySize: 1024,
    //             environment:{
    //               BOOKING_QUEUE_URL: queue.queueUrl,
    //               // airbnb_DB: airbnbDatabase.tableName,
    //             }
    //           }
    //         );

    //          /**
    //        * Process SQS Messages Lambda
    //        */
    //       const processSQSLambda: NodejsFunction = new NodejsFunction(
    //           this,
    //           "ProcessSqSBookingHandler",
    //           {
    //             tracing: Tracing.ACTIVE,
    //             runtime: lambda.Runtime.NODEJS_16_X,
    //             handler: "handler",
    //             entry: path.join(
    //               __dirname,
    //               "lambda-fns/booking",
    //               "processSqsBooking.ts"
    //             ),
    //             memorySize: 1024,
    //           }
    //         );

    //         // Create a data source for the Lambda function
    //       const lambdaDataSource = airbnbGraphqlApi.addLambdaDataSource('lambda-data-source', bookingLambda);

    //       // lambdaDataSource.createResolver('query-resolver', {
    //       //     typeName: 'Query',
    //       //     fieldName: 'listNotes',
    //       //   });

    //         const lambdaResolver = lambdaDataSource.createResolver('mutation-resolver', {
    //           typeName: 'Mutation',
    //           fieldName: 'createApartmentBooking',
    //         });

    //       airbnbDatabase.grantWriteData(processSQSLambda);
    //       airbnbDatabase.grantReadData(bookingLambda);
    //       queue.grantSendMessages(bookingLambda);
    //       queue.grantConsumeMessages(processSQSLambda);
    //       bookingLambda.addEnvironment("airbnb_DB", airbnbDatabase.tableName);
    //       bookingLambda.addEnvironment("BOOKING_QUEUE_URL", queue.queueUrl);
  }
}
