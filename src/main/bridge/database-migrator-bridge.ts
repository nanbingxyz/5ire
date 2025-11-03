import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { DatabaseMigrator } from "@/main/services/database-migrator";

export class DatabaseMigratorBridge extends Bridge.define("database-migrator", () => {
  const service = Container.inject(DatabaseMigrator);

  return {
    createStateStream() {
      return service.createStream((state) => {
        return {
          migrating: state.migrating,
        };
      });
    },
  };
}) {}
