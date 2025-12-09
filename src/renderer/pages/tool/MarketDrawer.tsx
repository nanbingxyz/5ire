import {
  Button,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  type InputOnChangeData,
  List,
  ListItem,
  SearchBox,
  type SearchBoxChangeEvent,
} from "@fluentui/react-components";
import { AddRegular, Dismiss24Regular } from "@fluentui/react-icons";
import { debounce } from "lodash";
import Mousetrap from "mousetrap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Empty from "renderer/components/Empty";
import Spinner from "renderer/components/Spinner";
import useMCPServerMarketStore from "stores/useMCPServerMarketStore";
import type { IMCPServer } from "types/mcp";
import { highlight } from "utils/util";

export default function ToolMarketDrawer({
  open,
  setOpen,
  onInstall,
}: {
  open: boolean;
  setOpen: (openState: boolean) => void;
  onInstall: (mcpServer: IMCPServer) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const filters = useMCPServerMarketStore((state) => state.filters);
  const { fetchServers, servers: allServers, setFilters } = useMCPServerMarketStore();

  const debouncedSearch = useRef(
    debounce((_: SearchBoxChangeEvent, data: InputOnChangeData) => {
      const value = data.value || "";
      const terms = value.split(/\s+/g).filter(Boolean);
      setFilters(terms);
    }, 500),
  ).current;

  const servers = useMemo(() => {
    let filteredServers = allServers;
    if (filters.length > 0) {
      filteredServers = allServers.filter((s: any) => {
        return filters.every((f) => {
          return (
            (s.name || s.key).toLowerCase().includes(f.toLowerCase()) ||
            (s.description || "").toLowerCase().includes(f.toLowerCase())
          );
        });
      });
    }
    return filteredServers.sort((a, b) => {
      const nameA = a.name || a.key;
      const nameB = b.name || b.key;
      return nameA.localeCompare(nameB);
    });
  }, [filters, allServers]);

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      await fetchServers();
    } finally {
      setLoading(false);
    }
  }, [fetchServers]);

  useEffect(() => {
    if (open) {
      Mousetrap.bind("esc", () => setOpen(false));
      loadServers();
    }
    return () => {
      Mousetrap.unbind("esc");
    };
  }, [open, loadServers]);

  return (
    <Drawer open={open} position="end" separator size="medium" onOpenChange={(_, data) => setOpen(data.open)}>
      <DrawerHeader className="border-none">
        <DrawerHeaderTitle
          action={
            <Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={() => setOpen(false)} />
          }
        >
          <div className="flex justify-start gap-2">
            <Button
              appearance="primary"
              icon={<AddRegular />}
              onClick={() => window.electron.openExternal("https://github.com/nanbingxyz/mcpsvr")}
            >
              {t("Common.Submit")}
            </Button>
            <SearchBox onChange={debouncedSearch} defaultValue={filters.join(" ")} />
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Spinner size={48} />
            <p className="mt-4 text-gray-400 dark:text-neutral-800">{t("Common.Loading")}</p>
          </div>
        ) : servers.length > 0 ? (
          <div className="overflow-y-auto -mr-5 pr-5 pb-5">
            <List navigationMode="composite">
              {servers.map((server) => (
                <ListItem key={server.key}>
                  <div
                    role="gridcell"
                    className="p-2 my-1 w-full rounded bg-gray-50 hover:bg-gray-100 dark:bg-stone-800 dark:hover:bg-stone-700"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex flex-start items-baseline flex-grow">
                        <div
                          role="gridcell"
                          className="text-base font-bold mt-1 flex"
                          dangerouslySetInnerHTML={{
                            __html: highlight(server.name || server.key, filters),
                          }}
                        />
                        {server.homepage && (
                          <button
                            type="button"
                            title="homepage"
                            className="text-gray-400 hover:text-gray-800 dark:text-gray-500 dark:hover:text-gray-300 ml-2"
                            onClick={() => window.electron.openExternal(server.homepage as string)}
                          >
                            {new URL(server.homepage).hostname}
                          </button>
                        )}
                      </div>
                      <Button appearance="primary" size="small" onClick={() => onInstall(server)}>
                        {t("Common.Action.Install")}
                      </Button>
                    </div>
                    <p
                      className="text-gray-700 dark:text-gray-400 text-xs"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: x
                      dangerouslySetInnerHTML={{
                        __html: highlight(server.description || "", filters),
                      }}
                    />
                  </div>
                </ListItem>
              ))}
            </List>
          </div>
        ) : (
          <Empty image="tools" text={t("Tool.Info.Empty")} />
        )}
      </DrawerBody>
    </Drawer>
  );
}
