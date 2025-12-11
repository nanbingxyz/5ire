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
  TableCellLayout,
  type TableColumnDefinition,
  useFluent,
  useScrollbarWidth,
} from "@fluentui/react-components";
import {
  bundleIcon,
  DeleteFilled,
  DeleteRegular,
  EditFilled,
  EditRegular,
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
import { capitalize } from "lodash";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PromptMergeStrategy } from "@/main/database/types";
import { useLivePromptsWithSelector } from "@/renderer/next/hooks/remote/use-live-prompts";
import { fmtDateTime } from "@/utils/util";

const EditIcon = bundleIcon(EditFilled, EditRegular);
const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);
const MoreHorizontalIcon = bundleIcon(MoreHorizontalFilled, MoreHorizontalRegular);

export type PromptGridProps = {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;

  keyword?: string;
};

export const PromptGrid = (props: PromptGridProps) => {
  const { t } = useTranslation();

  const [innerHeight, setInnerHeight] = useState(window.innerHeight);

  const prompts = useLivePromptsWithSelector((raw) => {
    return raw.rows
      .map((row) => row)
      .filter((row) => {
        if (!props.keyword) {
          return true;
        }

        return row.name.toLowerCase().includes(props.keyword.toLowerCase());
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

  // const renderMergeStrategyTag = (value: PromptMergeStrategy) => {
  //   return (
  //     <div
  //       style={{ fontSize: "12px" }}
  //       className={`flex text-center justify-start gap-1 items-center rounded-full text-xs px-2 py-[2px] bg-teal-50 dark:bg-teal-900 text-teal-600 dark:text-teal-300`}
  //     >
  //       <span className="-mt-0.5">{t(`Prompts.MergeStrategy.${capitalize(value)}`)}</span>
  //     </div>
  //   );
  // };

  const columns: TableColumnDefinition<(typeof prompts)[number]>[] = [
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
            <TableCellLayout truncate style={{ display: "block", width: "40vw" }}>
              <div className="flex flex-start items-center">
                <div className="ml-1.5 flex-1 min-w-0 max-w-max truncate">{item.name}</div>
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
    // createTableColumn({
    //   columnId: "tag",
    //   renderHeaderCell: () => {
    //     return t("Prompts.MergeStrategy");
    //   },
    //   renderCell: (item) => {
    //     return (
    //       <TableCell>
    //         <TableCellLayout truncate style={{ display: "block" }}>
    //           <div className="flex justify-start items-center gap-1 ml-2">
    //             {renderMergeStrategyTag(item.mergeStrategy)}
    //           </div>
    //         </TableCellLayout>
    //       </TableCell>
    //     );
    //   },
    // }),
    createTableColumn({
      columnId: "updatedAt",
      compare: (a, b) => {
        return a.updateTime > b.updateTime ? -1 : 1;
      },
      renderHeaderCell: () => {
        return t("Common.LastUpdated");
      },
      renderCell: (item) => {
        return (
          <TableCellLayout>
            <span className="latin">{fmtDateTime(item.updateTime)}</span>
          </TableCellLayout>
        );
      },
    }),
  ];

  const renderRow: RowRenderer<(typeof prompts)[number]> = ({ item, rowId }, style) => (
    <DataGridRow<(typeof prompts)[number]> key={rowId} style={style}>
      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
    </DataGridRow>
  );
  const { targetDocument } = useFluent();
  const scrollbarWidth = useScrollbarWidth({ targetDocument });

  return (
    <div className="w-full pr-4">
      <DataGrid
        items={prompts}
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
        <DataGridBody itemSize={50} height={innerHeight - 180}>
          {renderRow}
        </DataGridBody>
      </DataGrid>
    </div>
  );
};
