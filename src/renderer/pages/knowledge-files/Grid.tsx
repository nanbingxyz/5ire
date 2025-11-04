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
  DeleteFilled,
  DeleteRegular,
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
import { useNavigate, useParams } from "react-router-dom";
import ConfirmDialog from "renderer/components/ConfirmDialog";
import { fmtDateTime } from "utils/util";
import { useDocumentEmbedder } from "@/renderer/next/hooks/remote/use-document-embedder";
import { useLiveDocuments } from "@/renderer/next/hooks/remote/use-live-documents";

const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);

const MoreHorizontalIcon = bundleIcon(MoreHorizontalFilled, MoreHorizontalRegular);

/**
 * Grid component that displays knowledge collections in a data grid format.
 * Provides functionality for viewing, editing, deleting, pinning, and managing files for collections.
 *
 * @returns {JSX.Element} The rendered grid component
 */
export default function Grid() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { notifySuccess } = useToast();

  const documents = useLiveDocuments(id || "");
  const embedder = useDocumentEmbedder();

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
          notifySuccess(t("Knowledge.Notification.CollectionDeleted"));
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
        return (
          <TableCell>
            <TableCellLayout truncate style={{ width: "40vw" }}>
              <div className="flex flex-start items-center gap-1 pr-6">
                <div className="-mt-0.5 flex-1 min-w-0 max-w-max truncate">
                  <span className={item.status === "completed" ? "" : "text-gray-300"}>
                    {item.name} ({item.size}B)
                  </span>
                </div>
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
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => {
        return t("Common.Status");
      },
      renderCell: (item) => {
        if (item.status === "completed") {
          return (
            <TableCellLayout>
              <span>{t("Document.Status.Completed")}</span>
            </TableCellLayout>
          );
        }

        if (item.status === "processing") {
          const processing = embedder.processingDocuments[item.id];

          if (processing) {
            if (processing.status === "extracting") {
              return (
                <TableCellLayout>
                  <span>
                    {t("Document.ProcessStatus.Extracting")} {processing.progress * 100}%
                  </span>
                </TableCellLayout>
              );
            }

            if (processing.status === "embedding") {
              return (
                <TableCellLayout>
                  <span>
                    {t("Document.ProcessStatus.Embedding")} {processing.progress * 100}%
                  </span>
                </TableCellLayout>
              );
            }

            if (processing.status === "saving") {
              return (
                <TableCellLayout>
                  <span>
                    {t("Document.ProcessStatus.Saving")} {processing.progress * 100}%
                  </span>
                </TableCellLayout>
              );
            }
          }

          return (
            <TableCellLayout>
              <span>{t("Document.Status.Processing")}</span>
            </TableCellLayout>
          );
        }

        if (item.status === "failed") {
          return (
            <TableCellLayout>
              <span>{t("Document.Status.Failed")}</span>
            </TableCellLayout>
          );
        }

        if (item.status === "pending") {
          return (
            <TableCellLayout>
              <span>{t("Document.Status.Pending")}</span>
            </TableCellLayout>
          );
        }

        const renderProcessStatus = () => {};
      },
    }),
  ];

  const renderRow: RowRenderer<(typeof items)[number]> = ({ item, rowId }, style) => (
    <DataGridRow<(typeof items)[number]> key={rowId} style={style}>
      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
    </DataGridRow>
  );
  const { targetDocument } = useFluent();
  const scrollbarWidth = useScrollbarWidth({ targetDocument });

  return (
    <div className="w-full">
      <DataGrid
        items={items}
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
        <DataGridBody itemSize={50} height={innerHeight - 155}>
          {renderRow}
        </DataGridBody>
      </DataGrid>
      <ConfirmDialog
        open={!!deletingCollectionId}
        setOpen={() => setDeletingCollectionId(null)}
        message={t("Knowledge.Confirmation.DeleteCollection")}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
