-- Custom SQL migration file, put your code below! --

UPDATE "servers" SET "transport" = 'http-streamable' WHERE "transport" = 'sse';