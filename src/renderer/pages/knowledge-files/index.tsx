import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
} from "@fluentui/react-components";
import { asError } from "catch-unknown";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import Empty from "renderer/components/Empty";
import useToast from "@/hooks/useToast";
import { captureException } from "@/renderer/logging";
import { useEmbedder } from "@/renderer/next/hooks/remote/use-embedder";
import { useLiveCollections } from "@/renderer/next/hooks/remote/use-live-collections";
import Grid from "./Grid";

const ImportButton = () => {
  const { id } = useParams();
  const { t } = useTranslation();

  const toast = useToast();
  const navigate = useNavigate();
  const embedder = useEmbedder();
  const ready = embedder.status.type === "ready";

  const handleImport = () => {
    if (id) {
      window.bridge.documentManager.importDocumentsFromFileSystem({ collection: id }).catch((err) => {
        captureException(err);
        toast.notifyError(asError(err).message);
      });
    }
  };

  if (ready) {
    return (
      <Button appearance="primary" onClick={() => handleImport()}>
        {t("Common.Import")}
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger disableButtonEnhancement>
        <Button appearance="primary">{t("Common.Import")}</Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t("Knowledge.FileDrawer.DialogTitle.EmbeddingModelIsMissing")}</DialogTitle>
          <DialogContent>
            <p>{t("Knowledge.FileDrawer.DialogContent.EmbeddingModelIsRequired")}</p>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary">{t("Common.Cancel")}</Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={() => navigate("/settings")}>
              {t("Common.GoSettings")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default function KnowledgeFiles() {
  const { id } = useParams();
  const { t } = useTranslation();

  const navigate = useNavigate();

  const collections = useLiveCollections();

  const collection = useMemo(() => {
    if (!id) {
      return;
    }

    return collections.rows.find((collection) => collection.id === id);
  }, [collections, id]);

  return (
    <div className="page h-full">
      <div className="page-top-bar" />
      <div className="page-header">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6 truncate flex-1">{collection?.name}</h1>
          <div className="flex justify-end items-center gap-2">
            <Button appearance="subtle" onClick={() => navigate(-1)}>
              {t("Common.Back")}
            </Button>
            {collection && <ImportButton />}
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
