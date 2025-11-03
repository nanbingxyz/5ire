import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { DocumentEmbedder } from "@/main/services/document-embedder";

export class DocumentEmbedderBridge extends Bridge.define("document-embedder", () => {
  const service = Container.inject(DocumentEmbedder);

  return {
    createStateStream() {
      return service.createStream((state) => {
        return {
          processingDocuments: Object.fromEntries(
            Object.entries(state.processingDocuments).map(([id, value]) => {
              return [
                id,
                {
                  status: value.status,
                  progress: value.progress,
                },
              ];
            }),
          ),
        };
      });
    },
  };
}) {}
