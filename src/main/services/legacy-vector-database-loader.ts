import type { Connection } from "@lancedb/lancedb";

export class LegacyVectorDatabaseLoader {
  #connection?: Connection;

  async load(uri: string) {
    if (!this.#connection) {
      this.#connection = await Promise.resolve().then(async () => {
        return import("@lancedb/lancedb").then(async (lancedb) => {
          return lancedb.connect(uri);
        });
      });
    }

    return this.#connection;
  }

  close() {
    this.#connection?.close();
  }
}
