/* eslint-disable react/no-danger */

import {
  Button,
  createTableColumn,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
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
  MoreHorizontalFilled,
  MoreHorizontalRegular,
  PinFilled,
  PinOffFilled,
  PinOffRegular,
  PinRegular,
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
import useNav from "hooks/useNav";
import useToast from "hooks/useToast";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "renderer/components/ConfirmDialog";
import { match } from "ts-pattern";
import { fmtDateTime } from "utils/util";
import type { ProviderKind } from "@/main/database/types";
import { useLiveCollections } from "@/renderer/next/hooks/remote/use-live-collections";
import { useLivePromptsWithSelector } from "@/renderer/next/hooks/remote/use-live-prompts";
import { useLiveProvidersWithSelector } from "@/renderer/next/hooks/remote/use-live-providers";
import { useServerConnectionsWithSelector } from "@/renderer/next/hooks/remote/use-server-connections";
import {
  ProviderConfigurator,
  type ProviderConfiguratorInstance,
} from "@/renderer/pages/providers-next/ProviderConfigurator";
import { getBuiltinProviderLabel } from "@/renderer/pages/providers-next/utils";

const EditIcon = bundleIcon(EditFilled, EditRegular);
const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);
const PinIcon = bundleIcon(PinFilled, PinRegular);
const PinOffIcon = bundleIcon(PinOffFilled, PinOffRegular);

const MoreHorizontalIcon = bundleIcon(MoreHorizontalFilled, MoreHorizontalRegular);

const BUILTIN_PROVIDER_KINDS: Exclude<ProviderKind, "openai-compatible">[] = [
  "openai",
  "anthropic",
  "cohere",
  "google",
  "azure",
  "baidu",
  "doubao",
  "grok",
  "302-ai",
  "zhipu",
  "perplexity",
  "moonshot",
  "ollama",
  "lm-studio",
  "mistral",
  "deepseek",
];

const ProviderStateIndicator = (props: { id?: string }) => {
  const provider = useLiveProvidersWithSelector((raw) => {
    if (!props.id) {
      return;
    }
    return raw.find((item) => item.id === props.id);
  });

  if (!provider) {
    return <Circle16Filled className="text-gray-400 dark:text-gray-600 -mb-0.5" />;
  }

  if (provider.status.type === "ready") {
    return <Circle16Filled className="text-green-500 -mb-0.5" />;
  }

  if (provider.status.type === "loading") {
    return <CircleHintHalfVertical16Filled className="animate-spin -mb-0.5" />;
  }

  // TODO: Display error message.
  if (provider.status.type === "error") {
    return <Circle16Filled className="text-red-500 -mb-0.5" />;
  }
};

export default function ProviderList() {
  const { t } = useTranslation();

  const refProviderConfigurator = useRef<ProviderConfiguratorInstance | null>(null);

  const builtinProviders = useLiveProvidersWithSelector((state) => {
    return BUILTIN_PROVIDER_KINDS.map((kind) => {
      return {
        builtin: true,
        kind,
        data: state.find((item) => item.kind === kind),
      } as const;
    });
  });

  const customProviders = useLiveProvidersWithSelector((state) => {
    return state.map((item) => {
      return {
        builtin: false,
        data: item,
      } as const;
    });
  });

  const providers = useMemo(() => [...builtinProviders, ...customProviders], [builtinProviders, customProviders]);

  console.log(providers);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [innerHeight, setInnerHeight] = useState(window.innerHeight);
  const { notifySuccess } = useToast();

  useEffect(() => {
    const handleResize = () => {
      setInnerHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const handleConfirmDelete = () => {
    if (deletingId) {
      window.bridge.providersManager
        .deleteProvider({ id: deletingId })
        .then(() => {
          notifySuccess(t("Provider.Notification.Deleted"));
        })
        .catch(console.error);
    }
  };

  const handleManageModels = (id: string) => {};

  const renderName = (provider: (typeof providers)[number]) => {
    if (provider.builtin) {
      return <span className={provider.data ? "" : "text-gray-400"}>{getBuiltinProviderLabel(provider.kind)}</span>;
    }

    return <span>{provider.data.label}</span>;
  };

  const columns: TableColumnDefinition<(typeof providers)[number]>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => {
        return t("Common.Name");
      },
      renderCell: (item) => {
        return (
          <TableCell>
            <TableCellLayout truncate style={{ width: "40vw" }}>
              <div className="flex flex-start items-center gap-1 pr-6">
                <ProviderStateIndicator id={item.data?.id} />
                <div className="-mt-0.5 flex-1 min-w-0 max-w-max truncate">{renderName(item)}</div>
              </div>
            </TableCellLayout>
            <TableCellActions
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button icon={<MoreHorizontalIcon />} appearance="subtle" />
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    {!item.builtin ? (
                      <MenuItem
                        icon={<EditIcon />}
                        onClick={() => refProviderConfigurator.current?.openUpdateCustomMode(item.data.id)}
                      >
                        {t("Common.Edit")}
                      </MenuItem>
                    ) : (
                      <MenuItem
                        icon={<EditIcon />}
                        onClick={() => refProviderConfigurator.current?.openConfigureBuiltinMode(item.kind)}
                      >
                        {t("Common.Configure")}
                      </MenuItem>
                    )}

                    {!item.builtin && (
                      <MenuItem icon={<DeleteIcon />} onClick={() => handleDelete(item.data.id)}>
                        {t("Common.Delete")}
                      </MenuItem>
                    )}
                  </MenuList>
                </MenuPopover>
              </Menu>
            </TableCellActions>
          </TableCell>
        );
      },
    }),
    createTableColumn({
      columnId: "updatedAt",
      // compare: (a, b) => {
      //   return b.updateTime.getTime() - a.updateTime.getTime();
      // },
      renderHeaderCell: () => {
        return t("Common.LastUpdated");
      },
      renderCell: (item) => {
        return (
          <TableCellLayout>
            {<span className="latin">{item.data ? fmtDateTime(item.data.createTime) : ""}</span>}
          </TableCellLayout>
        );
      },
    }),
  ];

  const renderRow: RowRenderer<(typeof providers)[number]> = ({ item, rowId }, style) => (
    <DataGridRow<(typeof providers)[number]> key={rowId} style={style}>
      {({ renderCell }) => (
        <DataGridCell onClick={() => item.data && handleManageModels(item.data.id)}>{renderCell(item)}</DataGridCell>
      )}
    </DataGridRow>
  );
  const { targetDocument } = useFluent();
  const scrollbarWidth = useScrollbarWidth({ targetDocument });

  return (
    <div className="w-full">
      <DataGrid
        items={providers}
        columns={columns}
        focusMode="cell"
        sortable
        size="small"
        className="w-full"
        getRowId={(item) => (item.builtin ? item.kind : item.data.id)}
      >
        <DataGridHeader style={{ paddingRight: scrollbarWidth }}>
          <DataGridRow>
            {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
          </DataGridRow>
        </DataGridHeader>
        <DataGridBody itemSize={50} height={innerHeight - 155}>
          {renderRow}
        </DataGridBody>
      </DataGrid>
      <ConfirmDialog
        open={!!deletingId}
        setOpen={() => setDeletingId(null)}
        message={t("Provider.Confirmation.Delete")}
        onConfirm={handleConfirmDelete}
      />

      <ProviderConfigurator ref={refProviderConfigurator} />
    </div>
  );
}
