/* eslint-disable react/no-danger */

import {
  Button,
  createTableColumn,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Switch,
  TableCell,
  TableCellActions,
  TableCellLayout,
  type TableColumnDefinition,
  useFluent,
  useScrollbarWidth,
} from "@fluentui/react-components";
import {
  bundleIcon,
  Circle16Filled,
  CircleHintHalfVertical16Filled,
  DeleteFilled,
  DeleteRegular,
  EditFilled,
  EditRegular,
  GlobeErrorRegular,
  InfoRegular,
  MoreHorizontalFilled,
  MoreHorizontalRegular,
  WrenchScrewdriver20Filled,
  WrenchScrewdriver20Regular,
} from "@fluentui/react-icons";
import {
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  type RowRenderer,
} from "@fluentui-contrib/react-data-grid-react-window";
import { asError } from "catch-unknown";
import useMarkdown from "hooks/useMarkdown";
import useToast from "hooks/useToast";
import { capitalize } from "lodash";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { IMCPServer } from "types/mcp";
import { useServerConnectionsWithSelector } from "@/renderer/next/hooks/remote/use-server-connections";
import { useServersWithSelector } from "@/renderer/next/hooks/remote/use-servers";

const EditIcon = bundleIcon(EditFilled, EditRegular);
const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);
const WrenchScrewdriverIcon = bundleIcon(WrenchScrewdriver20Filled, WrenchScrewdriver20Regular);
const MoreHorizontalIcon = bundleIcon(MoreHorizontalFilled, MoreHorizontalRegular);

const ServerCapabilityTags = (props: { id: string }) => {
  const { t } = useTranslation();

  const connection = useServerConnectionsWithSelector((raw) => {
    return raw[props.id];
  });

  const styles = {
    resources: "bg-teal-50 dark:bg-teal-900 text-teal-600 dark:text-teal-300",
    tools: "bg-[#d8e6f1] dark:bg-[#365065] text-[#546576] dark:text-[#e3e9e5]",
    prompts: "bg-[#e6ddee] dark:bg-[#4e3868] text-[#9e7ebd] dark:text-[#d9d4de]",
  };

  const renderTag = (type: keyof typeof styles) => {
    return (
      <div
        style={{ fontSize: "12px" }}
        className={`flex text-center justify-start gap-1 items-center rounded-full text-xs px-2 py-[2px] ${styles[type]}`}
        key={type}
      >
        <span className="-mt-0.5">{t(`Tags.${capitalize(type)}`)}</span>
      </div>
    );
  };

  if (connection?.status === "connected") {
    const tags: React.ReactNode[] = [];

    if (connection.capabilities.tools) {
      tags.push(renderTag("tools"));
    }

    if (connection.capabilities.resources) {
      tags.push(renderTag("resources"));
    }

    if (connection.capabilities.prompts) {
      tags.push(renderTag("prompts"));
    }

    return <>{tags}</>;
  }

  return null;
};

const ServerStateIndicator = (props: { id: string }) => {
  const connection = useServerConnectionsWithSelector((raw) => {
    return raw[props.id];
  });

  if (!connection) {
    return <Circle16Filled className="text-gray-400 dark:text-gray-600 -mb-0.5" />;
  }

  if (connection.status === "connected") {
    return <Circle16Filled className="text-green-500 -mb-0.5" />;
  }

  if (connection.status === "connecting") {
    return <CircleHintHalfVertical16Filled className="animate-spin -mb-0.5" />;
  }

  // TODO: Display error message.
  if (connection.status === "error") {
    return <Circle16Filled className="text-red-500 -mb-0.5" />;
  }
};

export type ServerGridProps = {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onBrowse: (id: string) => void;
};

export const ServerGrid = (props: ServerGridProps) => {
  const { t } = useTranslation();
  const { render } = useMarkdown();
  const { notifyError } = useToast();

  const [innerHeight, setInnerHeight] = useState(window.innerHeight);

  const servers = useServersWithSelector((raw) => {
    return raw.rows.map((row) => row);
  });

  const connectedServers = useServerConnectionsWithSelector((raw) => {
    return Object.entries(raw)
      .filter(([_, connection]) => connection.status === "connected")
      .map(([id]) => {
        return id;
      });
  });

  useEffect(() => {
    const handleResize = () => {
      setInnerHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const renderServerJsonConfig = (server: (typeof servers)[number]) => {
    const json: Record<string, unknown> = {};

    json.id = server.id;
    json.lebel = server.label;
    json.description = server.description;
    json.type = server.transport === "stdio" ? "local" : "remote";

    if (server.transport === "stdio") {
      const [command, ...args] = server.endpoint.split(" ");
      json.command = command;
      json.arguments = args;
      json.env = server.config;
    } else {
      json.url = server.endpoint;
      json.headers = server.config;
      json.transport = server.transport === "http-streamable" ? "stream" : "sse";
    }

    json.approval_policy = server.approvalPolicy;
    json.is_active = server.active;

    return JSON.stringify(json, null, 2);
  };

  const columns: TableColumnDefinition<(typeof servers)[number]>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => {
        return a.label.localeCompare(b.label);
      },
      renderHeaderCell: () => {
        return t("Common.Name");
      },
      renderCell: (item) => {
        return (
          <TableCell>
            <TableCellLayout truncate style={{ display: "block", width: "40vw" }}>
              <div className="flex flex-start items-center">
                <ServerStateIndicator id={item.id} />
                <div className="ml-1.5 flex-1 min-w-0 max-w-max truncate">{item.label}</div>
                <div className="-mb-0.5">
                  <Popover withArrow size="small" positioning="after">
                    <PopoverTrigger disableButtonEnhancement>
                      <Button
                        icon={
                          item.transport !== "stdio" ? (
                            <GlobeErrorRegular className="w-4 h-4" />
                          ) : (
                            <InfoRegular className="w-4 h-4" />
                          )
                        }
                        size="small"
                        appearance="subtle"
                      />
                    </PopoverTrigger>
                    <PopoverSurface tabIndex={-1}>
                      <div
                        className="text-xs"
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: x
                        dangerouslySetInnerHTML={{
                          __html: render(`\`\`\`json\n${renderServerJsonConfig(item)}\n\`\`\``),
                        }}
                      />
                    </PopoverSurface>
                  </Popover>
                </div>
                <div className="ml-auto">
                  <Menu>
                    <MenuTrigger disableButtonEnhancement>
                      <Button icon={<MoreHorizontalIcon />} appearance="subtle" />
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem icon={<EditIcon />} onClick={() => props.onEdit(item.id)}>
                          {t("Common.Edit")}
                        </MenuItem>
                        <MenuItem icon={<DeleteIcon />} onClick={() => props.onDelete(item.id)}>
                          {t("Common.Delete")}
                        </MenuItem>
                        <MenuItem
                          disabled={!connectedServers.includes(item.id)}
                          icon={<WrenchScrewdriverIcon />}
                          onClick={() => props.onBrowse(item.id)}
                        >
                          {t("Common.Browse")}
                        </MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                </div>
              </div>
            </TableCellLayout>
          </TableCell>
        );
      },
    }),
    createTableColumn({
      columnId: "capabilities",
      renderHeaderCell: () => {
        return t("Common.Capabilities");
      },
      renderCell: (item) => {
        return (
          <TableCell>
            <TableCellLayout truncate style={{ display: "block" }}>
              <div className="flex justify-start items-center gap-1 ml-2">
                <ServerCapabilityTags id={item.id} />
              </div>
            </TableCellLayout>
          </TableCell>
        );
      },
    }),
    createTableColumn({
      columnId: "key",
      renderHeaderCell: () => {
        return "";
      },
      renderCell: (item) => {
        return (
          <TableCell>
            <TableCellActions>
              <Switch
                checked={item.active}
                aria-label={t("Common.State")}
                onChange={(_, data) => {
                  if (data.checked) {
                    window.bridge.mcpServersManager.activateServer({ id: item.id }).catch((error) => {
                      notifyError(asError(error).message || t("MCP.ServerActivationFailed"));
                    });
                  } else {
                    window.bridge.mcpServersManager.deactivateServer({ id: item.id }).catch((error) => {
                      notifyError(asError(error).message || t("MCP.ServerDeactivationFailed"));
                    });
                  }
                }}
              />
            </TableCellActions>
          </TableCell>
        );
      },
    }),
  ];

  const renderRow: RowRenderer<IMCPServer> = ({ item, rowId }, style) => (
    <DataGridRow<IMCPServer> key={rowId} style={style}>
      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
    </DataGridRow>
  );
  const { targetDocument } = useFluent();
  const scrollbarWidth = useScrollbarWidth({ targetDocument });

  return (
    <div className="w-full pr-4">
      <DataGrid
        items={servers}
        columns={columns}
        focusMode="cell"
        sortable
        size="small"
        className="w-full"
        getRowId={(item) => item.id}
      >
        <DataGridHeader style={{ paddingRight: scrollbarWidth }}>
          <DataGridRow>
            {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
          </DataGridRow>
        </DataGridHeader>
        <DataGridBody<IMCPServer> itemSize={50} height={innerHeight - 180}>
          {renderRow}
        </DataGridBody>
      </DataGrid>
    </div>
  );
};
