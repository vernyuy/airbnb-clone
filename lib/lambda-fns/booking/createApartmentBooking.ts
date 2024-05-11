import { Logger } from "@aws-lambda-powertools/logger";
import {  DynamoDB, SQS } from "aws-sdk";
import { uuid } from "../../utils";
// import CreateBookingInput from "./CreateBookingInput";
// import { BookingEntity } from "./entities/bookingEntity";
import { MutationCreateApartmentBookingArgs, Booking } from '../../../src/types/appsync'

import { createItem } from "../../../src/lib/helpers";

async function createApartmentBooking(
  appsyncInput: MutationCreateApartmentBookingArgs,
  logger: Logger
): Promise<boolean> {
  const documentClient = new DynamoDB.DocumentClient();
  let tableName = process.env.ACMS_DB;
  const BOOKING_QUEUE_URL = process.env.BOOKING_QUEUE_URL;
  const createdOn = Date.now().toString();
  const id: string = uuid();
  const sqs = new SQS();

  console.log(appsyncInput.input);

  if (BOOKING_QUEUE_URL === undefined) {
    logger.error(`Couldn't get the queue url name`);
    throw Error("Couldn't get queue url");
  }

  const bookingInput = createItem({
    id: id,
    ...appsyncInput.input,
    createdOn,
  });
  if (tableName === undefined) {
    logger.error(`Couldn't get the table name`);
    tableName = "AcmsDynamoDBTable";
  }

  logger.info(`create booking input info", ${JSON.stringify(bookingInput)}`);
  const params = {
    TableName: tableName,
    IndexName: "getAllApartmentsPerUser",
    KeyConditionExpression: "#GSI1PK = :GSI1PK AND #GSI1SK = :GSI1SK",
    FilterExpression: "#bookingStatus = :bookingStatus",
    ExpressionAttributeNames: {
      "#GSI1PK": "GSI1PK",
      "#GSI1SK": "GSI1SK",
      "#bookingStatus": "bookingStatus",
    },
    ExpressionAttributeValues: {
      ":GSI1PK": `USER#${appsyncInput.input.userId}`,
      ":GSI1SK": `APARTMENT#${appsyncInput.input.apartmentId}`,
      ":bookingStatus": "PENDING",
    },
  };

      logger.info(`sqs pre message ${JSON.stringify(bookingInput)}`);
      logger.info(`sqs  queue url ${BOOKING_QUEUE_URL}`);
      const sqsParams: SQS.Types.SendMessageRequest = {
        MessageBody: JSON.stringify(bookingInput),
        QueueUrl: BOOKING_QUEUE_URL,
      };

      try {
        await sqs.sendMessage(sqsParams).promise();
        return true;
      } catch (error) {
        logger.info(`an error occured while sending message to sqs", ${error}`);
        throw Error(`an error occured while sending message to sqs", ${error}`);
      }
}

export default createApartmentBooking;
