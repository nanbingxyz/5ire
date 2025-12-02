/* eslint-disable react/no-danger */

import {
  Button,
  createTableColumn,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Spinner,
  TableCell,
  TableCellActions,
  TableCellLayout,
  type TableColumnDefinition,
  Tooltip,
  useFluent,
  useScrollbarWidth,
} from "@fluentui/react-components";
import {
  bundleIcon,
  CircleHintFilled,
  DeleteFilled,
  DeleteRegular,
  DismissCircleColor,
  MoreHorizontalFilled,
  MoreHorizontalRegular,
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
import useToast from "hooks/useToast";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import ConfirmDialog from "renderer/components/ConfirmDialog";
import { fmtDateTime } from "utils/util";
import type { Document } from "@/main/database/types";
import { useDocumentEmbedder } from "@/renderer/next/hooks/remote/use-document-embedder";
import { useLiveDocuments } from "@/renderer/next/hooks/remote/use-live-documents";

const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);

const MoreHorizontalIcon = bundleIcon(MoreHorizontalFilled, MoreHorizontalRegular);

type StatusIndicatorProps = {
  item: Pick<Document, "status" | "id" | "error">;
};

const StatusIndicator = (props: StatusIndicatorProps) => {
  const { t } = useTranslation();

  const embedder = useDocumentEmbedder();

  // console.log(embedder.processingDocuments, props.item.id);

  if (props.item.status === "completed") {
    return null;
  }

  if (props.item.status === "failed") {
    return (
      <Tooltip
        relationship="description"
        content={{
          children: `${t("Document.ImportFailed")}: ${props.item.error || "Unknown error."}`,
        }}
      >
        <DismissCircleColor fontSize="16px" />
      </Tooltip>
    );
  }

  if (props.item.status === "processing") {
    let content = "";

    const processing = embedder.processingDocuments[props.item.id];

    if (!processing) {
      content = t("Document.Status.Processing");
    } else {
      content = {
        embedding: t("Document.ProcessStatus.Embedding"),
        extracting: t("Document.ProcessStatus.Extracting"),
        saving: t("Document.ProcessStatus.Saving"),
      }[processing.status];

      content += `... ${(processing.progress * 100).toFixed(1)}%`;
    }

    return (
      <Tooltip
        content={{
          children: content,
        }}
        withArrow
        relationship="description"
      >
        <Spinner size="extra-tiny" />
      </Tooltip>
    );
  }

  return (
    <Tooltip relationship="description" content={{ children: t("Document.Status.Pending") }}>
      <CircleHintFilled fontSize="16px" />
    </Tooltip>
  );
};

const formatSize = (item: Document) => {
  if (item.size === 0) {
    return "0B";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(item.size) / Math.log(1024));
  const value = item.size / 1024 ** i;

  return ` ${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

export default function Grid() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { notifySuccess } = useToast();

  const documents = useLiveDocuments(id || "");

  const items = useMemo(() => documents.rows, [documents]);

  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);

  const [innerHeight, setInnerHeight] = useState(window.innerHeight);

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
    setDeletingCollectionId(id);
  };

  const handleConfirmDelete = () => {
    if (deletingCollectionId) {
      window.bridge.documentManager
        .deleteDocument({ id: deletingCollectionId })
        .then(() => {
          notifySuccess(t("Knowledge.Notification.DocumentDeleted"));
        })
        .catch(console.error);
    }
  };

  /**
   * Configuration for the data grid columns including name, last updated, and number of files.
   * Each column defines sorting behavior, header rendering, and cell content rendering.
   *
   * @type {TableColumnDefinition<Item>[]}
   */
  const columns: TableColumnDefinition<(typeof items)[number]>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => {
        return a.name.localeCompare(b.name);
      },
      renderHeaderCell: () => {
        return t("Common.Name");
      },
      renderCell: (item) => {
        const renderName = () => {
          return <span className={item.status === "completed" ? "" : "text-gray-300"}>{item.name}</span>;
        };

        const renderStatus = () => {
          return <StatusIndicator item={item} />;
        };

        return (
          <TableCell>
            <TableCellLayout truncate style={{ width: "40vw" }}>
              <div className="flex flex-start items-center gap-1 pr-6">
                {renderStatus()}
                <div className="-mt-0.5 flex-1 min-w-0 max-w-max truncate">{renderName()}</div>
              </div>
            </TableCellLayout>
            <TableCellActions>
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button icon={<MoreHorizontalIcon />} appearance="subtle" />
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem icon={<DeleteIcon />} onClick={() => handleDelete(item.id)}>
                      {t("Common.Delete")}{" "}
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            </TableCellActions>
          </TableCell>
        );
      },
    }),
    createTableColumn({
      columnId: "size",
      compare: (a, b) => {
        return b.size - a.size;
      },
      renderHeaderCell: () => {
        return t("Common.Size");
      },
      renderCell: (item) => {
        return (
          <TableCellLayout>
            <span className="text-gray-400">{item.status === "completed" ? formatSize(item) : ""}</span>
          </TableCellLayout>
        );
      },
    }),
    createTableColumn({
      columnId: "importTime",
      compare: (a, b) => {
        return b.createTime.getTime() - a.createTime.getTime();
      },
      renderHeaderCell: () => {
        return t("Common.ImportTime");
      },
      renderCell: (item) => {
        return (
          <TableCellLayout>
            <span className="latin">{fmtDateTime(item.createTime)}</span>
          </TableCellLayout>
        );
      },
    }),
  ];

  const renderRow: RowRenderer<(typeof items)[number]> = ({ item, rowId }, style) => (
    <DataGridRow<(typeof items)[number]> key={item.id} style={style}>
      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
    </DataGridRow>
  );

  const { targetDocument } = useFluent();
  const scrollbarWidth = useScrollbarWidth({ targetDocument });

  const columnSizingOptions = {
    name: {
      minWidth: 300,
      defaultWidth: 400,
      idealWidth: 600,
    },
    size: {
      minWidth: 80,
      defaultWidth: 120,
    },
    importTime: {
      defaultWidth: 160,
      minWidth: 160,
      idealWidth: 180,
    },
  };
  return (
    <div className="w-full">
      <DataGrid
        items={items}
        columns={columns}
        sortable
        size="small"
        className="w-full"
        getRowId={(item) => item.id}
        resizableColumns
        columnSizingOptions={columnSizingOptions}
        resizableColumnsOptions={{
          autoFitColumns: true,
        }}
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
        open={!!deletingCollectionId}
        setOpen={() => setDeletingCollectionId(null)}
        message={t("Knowledge.Confirmation.DeleteDocument")}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
