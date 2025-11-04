import { Button } from "@fluentui/react-components";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import Empty from "renderer/components/Empty";
import { captureException } from "@/renderer/logging";
import { useEmbedder } from "@/renderer/next/hooks/remote/use-embedder";
import { useLiveCollections } from "@/renderer/next/hooks/remote/use-live-collections";
import Grid from "./Grid";

export default function KnowledgeFiles() {
  const { id } = useParams();
  const { t } = useTranslation();

  const navigate = useNavigate();
  const embedder = useEmbedder();
  const collections = useLiveCollections();

  const collection = useMemo(() => {
    if (!id) {
      return;
    }

    return collections.rows.find((collection) => collection.id === id);
  }, [collections, id]);

  const handleImport = () => {
    if (!collection) {
      return;
    }

    window.electron.knowledge
      .selectFiles()
      .then((data: any) => {
        const files = JSON.parse(data) as Array<{ path: string }>;
        window.bridge.documentManager.importDocuments({
          collection: collection.id,
          urls: files.map((file) => `file://${file.path}`),
        });
      })
      .catch((err) => {
        captureException(err);
      });
  };

  return (
    <div className="page h-full">
      <div className="page-top-bar" />
      <div className="page-header">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{collection?.name}</h1>
          <div className="flex justify-end w-full items-center gap-2">
            <Button appearance="subtle" onClick={() => navigate(-1)}>
              {t("Common.Cancel")}
            </Button>
            {collection && (
              <Button appearance="primary" onClick={() => handleImport()} disabled={embedder.status.type !== "ready"}>
                {t("Common.New")}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        {collection ? (
          <div className="mr-5 flex justify-start gap-2 flex-wrap">
            <Grid />
          </div>
        ) : (
          <Empty image="knowledge" text={t("No knowledge base yet.")} />
        )}
      </div>
    </div>
  );
}
