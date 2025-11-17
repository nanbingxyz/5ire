import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { LegacyDataMigrator } from "@/main/services/legacy-data-migrator";

export class LegacyDataMigratorBridge extends Bridge.define("legacy-data-migrator", () => {
  const service = Container.inject(LegacyDataMigrator);

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
