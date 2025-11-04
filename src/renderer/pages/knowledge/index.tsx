import { Button } from "@fluentui/react-components";
import useNav from "hooks/useNav";
import { useTranslation } from "react-i18next";
import Empty from "renderer/components/Empty";
import { useLiveCollections } from "@/renderer/next/hooks/remote/use-live-collections";
import Grid from "./Grid";

export default function Knowledge() {
  const { t } = useTranslation();
  const navigate = useNav();
  const collections = useLiveCollections();

  return (
    <div className="page h-full">
      <div className="page-top-bar" />
      <div className="page-header">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t("Common.Knowledge")}</h1>
          <div className="flex justify-end w-full items-center gap-2">
            <Button appearance="primary" onClick={() => navigate("/knowledge/collection-form")}>
              {t("Common.New")}
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        {collections.rows.length ? (
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
