import { asError } from "catch-unknown";
import type { EventSourceMessage } from "eventsource-parser/stream";
import type { ZodType } from "zod/v4";
import { JSONUtils } from "@/utils";

export class JSONEventSourceParserStream<T> extends TransformStream<
  EventSourceMessage,
  JSONEventSourceParserStream.Message<T>
> {
  constructor(schema: ZodType<T>) {
    super({
      async transform(event, controller) {
        if (event.data === "[DONE]") {
          return;
        }

        let json: unknown;

        try {
          json = JSONUtils.secureParse(event.data);
        } catch (error) {
          controller.enqueue({
            success: false,
            error: asError(error),
          });
        }

        schema.safeParseAsync(json).then((result) => {
          if (result.success) {
            controller.enqueue({
              success: true,
              data: result.data,
            });
          } else {
            controller.enqueue({
              success: false,
              error: result.error,
            });
          }
        });
      },
    });
  }
}

export namespace JSONEventSourceParserStream {
  export type Message<T> =
    | {
        success: true;
        data: T;
      }
    | {
        success: false;
        error: Error;
      };
}
