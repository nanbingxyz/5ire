import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { DocumentManager } from "@/main/services/document-manager";

export class DocumentManagerBridge extends Bridge.define("document-manager", () => {
  const service = Container.inject(DocumentManager);

  return {
    createCollection: service.createCollection.bind(service),
    deleteCollection: service.deleteCollection.bind(service),
    updateCollection: service.updateCollection.bind(service),
    importDocuments: service.importDocuments.bind(service),
    deleteDocument: service.deleteDocument.bind(service),
    liveCollections: service.liveCollections.bind(service),
  };
}) {}
