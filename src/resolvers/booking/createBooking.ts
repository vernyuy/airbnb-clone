import { Context, DynamoDBPutItemRequest, util } from "@aws-appsync/utils";
import { createItem } from "../../lib/helpers";
import {
  MutationCreateApartmentBookingArgs,
  Booking,
} from "../../types/appsync";

export function request(
  ctx: Context<MutationCreateApartmentBookingArgs>
): DynamoDBPutItemRequest {
  // add timestamps
  const item = createItem(ctx.args.input!);

  return {
    operation: "PutItem",
    key: util.dynamodb.toMapValues({
      PK: `APARTMENT#${item.apartmentId}`,
      SK: `BOOKING#${util.autoId()}`,
    }),
    attributeValues: util.dynamodb.toMapValues({
      GSI1PK: `USER#${item.userId}`,
      GSI1SK: `APARTMENT#${item.apartmentId}`,
      ENTITY: "BOOKING",
      publishDate: util.time.nowISO8601(),
      ...item,
    }),
  };
}

export function response(
  ctx: Context<
    MutationCreateApartmentBookingArgs,
    object,
    object,
    object,
    Booking
  >
) {
  return ctx.result;
}
