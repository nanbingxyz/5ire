import {
  Menu,
  type MenuButtonProps,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  SplitButton,
} from "@fluentui/react-components";
import { AddRegular, BuildingShopFilled, BuildingShopRegular, bundleIcon } from "@fluentui/react-icons";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Empty from "renderer/components/Empty";
import ComposioLogo from "renderer/components/icons/ComposioLogo";
import HigressLogo from "renderer/components/icons/HigressLogo";
import TooltipIcon from "renderer/components/TooltipIcon";
import type { IMCPServer } from "types/mcp";
import { useServersWithSelector } from "@/renderer/next/hooks/remote/use-servers";
import { ServerBrowser, type ServerBrowserInstance } from "@/renderer/pages/tool/ServerBrowser";
import { ServerDeleteConfirm, type ServerDeleteConfirmInstance } from "@/renderer/pages/tool/ServerDeleteConfirm";
import { ServerEditDialog, type ServerEditDialogInstance } from "@/renderer/pages/tool/ServerEditDialog";
import DetailDialog from "./DetailDialog";
import ToolInstallDialog from "./InstallDialog";
import ToolMarketDrawer from "./MarketDrawer";
import { ServerGrid } from "./ServerGrid";

const BuildingShopIcon = bundleIcon(BuildingShopFilled, BuildingShopRegular);

export default function Tools() {
  const { t } = useTranslation();
  const [mktServer, setMktServer] = useState<IMCPServer | null>(null);
  const [server] = useState<IMCPServer | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const refServerEditDialog = useRef<ServerEditDialogInstance>(null);
  const refServerDeleteConfirm = useRef<ServerDeleteConfirmInstance>(null);
  const refServerBrowser = useRef<ServerBrowserInstance>(null);

  const serversIsEmpty = useServersWithSelector((raw) => {
    return raw.rows.map((row) => row.id).length === 0;
  });

  const handleCreateLocalServer = useCallback(() => {
    refServerEditDialog.current?.openCreateMode("local");
  }, []);

  const handleCreateRemoteServer = useCallback(() => {
    refServerEditDialog.current?.openCreateMode("remote");
  }, []);

  const handleEdit = useCallback((id: string) => {
    refServerEditDialog.current?.openUpdateMode(id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    refServerDeleteConfirm.current?.delete(id);
  }, []);

  const handleBrowse = useCallback((id: string) => {
    refServerBrowser.current?.browse(id);
  }, []);

  const installServer = useCallback((svr: IMCPServer) => {
    setMktServer(svr);
    setInstallDialogOpen(true);
  }, []);

  return (
    <div className="page h-full">
      <div className="page-top-bar" />
      <div className="page-header w-full">
        <div className="flex flex-col items-start w-full">
          <div className="flex justify-between items-baseline w-full">
            <h1 className="text-2xl flex-shrink-0 mr-6">{t("Common.Tools")}</h1>
            <div className="flex justify-end w-full items-center gap-2">
              <Menu positioning="below-end">
                <MenuTrigger disableButtonEnhancement>
                  {(triggerProps: MenuButtonProps) => (
                    <SplitButton
                      size="medium"
                      icon={<AddRegular />}
                      menuButton={triggerProps}
                      appearance="primary"
                      primaryActionButton={{
                        onClick: handleCreateLocalServer,
                      }}
                    >
                      {t("Common.Local")}
                    </SplitButton>
                  )}
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem onClick={handleCreateRemoteServer}>{t("Common.Remote")}</MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
              <Menu positioning="below-end">
                <MenuTrigger disableButtonEnhancement>
                  {(triggerProps: MenuButtonProps) => (
                    <SplitButton
                      size="medium"
                      icon={<BuildingShopIcon />}
                      menuButton={triggerProps}
                      primaryActionButton={{
                        onClick: () => setMarketOpen(true),
                      }}
                    >
                      {t("Tools.Market")}
                    </SplitButton>
                  )}
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem
                      icon={<HigressLogo />}
                      onClick={() => window.electron.openExternal("https://mcp.higress.ai")}
                    >
                      Higress Market
                    </MenuItem>
                    <MenuItem
                      icon={<ComposioLogo />}
                      onClick={() => window.electron.openExternal("https://mcp.composio.dev/")}
                    >
                      Composio Market
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            </div>
          </div>
          <div className="tips flex justify-start items-center md:mt-0 mt-2">
            {t("Common.MCPServers")}
            <TooltipIcon tip={t("Tools.PrerequisiteDescription")} />
          </div>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        {serversIsEmpty ? (
          <Empty image="tools" text={t("Tool.Info.Empty")} />
        ) : (
          <ServerGrid onEdit={handleEdit} onDelete={handleDelete} onBrowse={handleBrowse} />
        )}
      </div>
      {/*<LocalServerEditDialog open={localServerEditDialogOpen} setOpen={setLocalServerEditDialogOpen} server={server} />*/}
      {/*<RemoteServerEditDialog*/}
      {/*  open={remoteServerEditDialogOpen}*/}
      {/*  setOpen={setRemoteServerEditDialogOpen}*/}
      {/*  server={server}*/}
      {/*/>*/}
      {server && <DetailDialog open={detailDialogOpen} setOpen={setDetailDialogOpen} server={server} />}
      {mktServer && <ToolInstallDialog server={mktServer} open={installDialogOpen} setOpen={setInstallDialogOpen} />}
      <ToolMarketDrawer open={marketOpen} setOpen={setMarketOpen} onInstall={installServer} />

      <ServerEditDialog ref={refServerEditDialog} />
      <ServerDeleteConfirm ref={refServerDeleteConfirm} />
      <ServerBrowser ref={refServerBrowser} />
    </div>
  );
}
