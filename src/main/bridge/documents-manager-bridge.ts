import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { DocumentsManager } from "@/main/services/documents-manager";

export class DocumentsManagerBridge extends Bridge.define("documents-manager", () => {
  const service = Container.inject(DocumentsManager);

  return {
    createCollection: service.createCollection.bind(service),
    deleteCollection: service.deleteCollection.bind(service),
    updateCollection: service.updateCollection.bind(service),
    liveCollections: service.liveCollections.bind(service),
  };
}) {}
