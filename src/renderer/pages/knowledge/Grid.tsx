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
  Tooltip,
  useFluent,
  useScrollbarWidth,
} from "@fluentui/react-components";
import {
  bundleIcon,
  DeleteFilled,
  DeleteRegular,
  DocumentFolderFilled,
  DocumentFolderRegular,
  EditFilled,
  EditRegular,
  Info16Regular,
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
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "renderer/components/ConfirmDialog";
import { fmtDateTime } from "utils/util";
import { useLiveCollections } from "@/renderer/next/hooks/remote/use-live-collections";

const EditIcon = bundleIcon(EditFilled, EditRegular);
const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);
const PinIcon = bundleIcon(PinFilled, PinRegular);
const PinOffIcon = bundleIcon(PinOffFilled, PinOffRegular);
const DocumentFolderIcon = bundleIcon(DocumentFolderFilled, DocumentFolderRegular);

const MoreHorizontalIcon = bundleIcon(MoreHorizontalFilled, MoreHorizontalRegular);

/**
 * Grid component that displays knowledge collections in a data grid format.
 * Provides functionality for viewing, editing, deleting, pinning, and managing files for collections.
 *
 * @returns {JSX.Element} The rendered grid component
 */
export default function Grid() {
  const { t } = useTranslation();

  const navigate = useNav();
  const collections = useLiveCollections();
  const items = useMemo(() => collections.rows, [collections]);

  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);

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

  const handleTogglePin = (id: string) => {
    window.bridge.documentManager
      .toggleCollectionPin({ id })
      .then(() => {
        notifySuccess(t("Knowledge.Notification.CollectionDeleted"));
      })
      .catch(console.error);
  };

  const handleDelete = (id: string) => {
    setDeletingCollectionId(id);
  };

  const handleConfirmDelete = () => {
    if (deletingCollectionId) {
      window.bridge.documentManager
        .deleteCollection({ id: deletingCollectionId })
        .then(() => {
          notifySuccess(t("Knowledge.Notification.CollectionDeleted"));
        })
        .catch(console.error);
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/knowledge/collection-form/${id}`);
  };

  const handleManageFiles = (id: string) => {
    navigate(`/knowledge-files/${id}`);
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
                <div className="-mt-0.5 flex-1 min-w-0 max-w-max truncate">{item.name}</div>
                {item.description && (
                  <Tooltip content={item.description} relationship="label" withArrow appearance="inverted">
                    <Button icon={<Info16Regular />} size="small" appearance="subtle" />
                  </Tooltip>
                )}
                {item.pinedTime ? <PinFilled className="ml-1" /> : null}
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
                    <MenuItem icon={<EditIcon />} onClick={() => handleEdit(item.id)}>
                      {t("Common.Edit")}
                    </MenuItem>
                    <MenuItem icon={<DeleteIcon />} onClick={() => handleDelete(item.id)}>
                      {t("Common.Delete")}{" "}
                    </MenuItem>
                    {item.pinedTime ? (
                      <MenuItem icon={<PinOffIcon />} onClick={() => handleTogglePin(item.id)}>
                        {t("Common.Unpin")}{" "}
                      </MenuItem>
                    ) : (
                      <MenuItem icon={<PinIcon />} onClick={() => handleTogglePin(item.id)}>
                        {t("Common.Pin")}{" "}
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
      compare: (a, b) => {
        return b.updateTime.getTime() - a.updateTime.getTime();
      },
      renderHeaderCell: () => {
        return t("Common.LastUpdated");
      },
      renderCell: (item) => {
        return <TableCellLayout>{<span className="latin">{fmtDateTime(item.updateTime)}</span>}</TableCellLayout>;
      },
    }),
    createTableColumn({
      columnId: "numOfFiles",
      compare: (a, b) => {
        return b.documents - a.documents;
      },
      renderHeaderCell: () => {
        return t("Common.NumberOfFiles");
      },
      renderCell: (item) => {
        return (
          <TableCellLayout>
            <span className="latin">{item.documents}</span>
          </TableCellLayout>
        );
      },
    }),
  ];

  const renderRow: RowRenderer<(typeof items)[number]> = ({ item, rowId }, style) => (
    <DataGridRow<(typeof items)[number]> key={rowId} style={style}>
      {({ renderCell }) => <DataGridCell onClick={() => handleManageFiles(item.id)}>{renderCell(item)}</DataGridCell>}
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
