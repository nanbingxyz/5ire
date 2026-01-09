import { Button } from "@fluentui/react-components";
import {
  Apps24Filled,
  Apps24Regular,
  BookmarkMultiple24Filled,
  BookmarkMultiple24Regular,
  bundleIcon,
  ChatAdd24Filled,
  ChatAdd24Regular,
  EmojiSparkle24Filled,
  EmojiSparkle24Regular,
  FolderAdd24Filled,
  FolderAdd24Regular,
  Library24Filled,
  Library24Regular,
  Wand24Filled,
  Wand24Regular,
} from "@fluentui/react-icons";
import { TEMP_CHAT_ID } from "consts";
import useNav from "hooks/useNav";
import usePlatform from "hooks/usePlatform";
import Mousetrap from "mousetrap";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Spinner from "renderer/components/Spinner";
import useChatStore from "stores/useChatStore";
import { useServerConnectionsWithSelector } from "@/renderer/next/hooks/remote/use-server-connections";
import { useServersWithSelector } from "@/renderer/next/hooks/remote/use-servers";
import WorkspaceMenu from "./WorkspaceMenu";

const AppsIcon = bundleIcon(Apps24Filled, Apps24Regular);
const BookmarkMultipleIcon = bundleIcon(BookmarkMultiple24Filled, BookmarkMultiple24Regular);
const EmojiSparkleIcon = bundleIcon(EmojiSparkle24Filled, EmojiSparkle24Regular);
const ChatAddIcon = bundleIcon(ChatAdd24Filled, ChatAdd24Regular);
const KnowledgeIcon = bundleIcon(Library24Filled, Library24Regular);
const WandIcon = bundleIcon(Wand24Filled, Wand24Regular);
const FolderAddIcon = bundleIcon(FolderAdd24Filled, FolderAdd24Regular);

const IS_ASSISTANTS_ENABLED = false;

export default function GlobalNav({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const navigate = useNav();
  const { isDarwin } = usePlatform();
  const isMCPServersLoading = useServerConnectionsWithSelector((raw) => {
    return Object.values(raw).some((connection) => connection.status === "connecting");
  });
  const { createFolder, selectFolder } = useChatStore();

  const numOfActiveServers = useServersWithSelector((raw) => {
    return raw.rows.filter((row) => row.active).length;
  });

  const activeToolsCount = useMemo(() => {
    if (collapsed) {
      return null;
    }
    if (isMCPServersLoading) {
      return <Spinner size={18} className="mx-2.5 -mb-1" />;
    }
    return numOfActiveServers ? (
      <div className="flex justify-start items-center px-2.5 gap-1 flex-shrink-0">
        <div className="w-2 h-2 bg-green-500 dark:bg-green-600 rounded-full" />
        <span>{`${numOfActiveServers}`}</span>
      </div>
    ) : null;
  }, [isMCPServersLoading, numOfActiveServers, collapsed]);

  useEffect(() => {
    Mousetrap.bind("alt+1", () => navigate("/tool"));
    Mousetrap.bind("alt+2", () => navigate("/knowledge"));
    Mousetrap.bind("alt+3", () => navigate("/bookmarks"));
    Mousetrap.bind("mod+n", () => navigate(`/chats/${TEMP_CHAT_ID}`));
    return () => {
      Mousetrap.unbind("alt+1");
      Mousetrap.unbind("alt+2");
      Mousetrap.unbind("alt+3");
      Mousetrap.unbind("mod+n");
    };
  }, [navigate]);

  return (
    <div
      className={`relative ${
        collapsed ? "text-center" : ""
      } ${isDarwin ? "darwin" : "mt-8 md:mt-0"} border-b border-base py-2`}
    >
      <div className="px-1">
        <WorkspaceMenu collapsed={collapsed} />
      </div>
      {IS_ASSISTANTS_ENABLED && (
        <div className="px-1">
          <Button appearance="transparent" icon={<EmojiSparkleIcon />} className="w-full justify-start">
            {collapsed || t("Common.Assistants")}
          </Button>
        </div>
      )}
      {false && (
        <div className="px-1">
          <Button
            appearance="transparent"
            icon={<AppsIcon />}
            className="w-full justify-start"
            onClick={() => navigate("/apps")}
          >
            {collapsed ? null : t("Common.Apps")}
          </Button>
        </div>
      )}
      <div className={`px-1 flex ${collapsed ? "justify-center" : "justify-between"} items-center`}>
        <Button
          appearance="transparent"
          title="Alt+1"
          icon={<WandIcon />}
          className="w-full justify-start"
          onClick={() => navigate("/tool")}
        >
          {collapsed ? null : t("Common.Tools")}
        </Button>
        <div>{activeToolsCount}</div>
      </div>
      <div className="px-1">
        <Button
          appearance="transparent"
          title="Alt+2"
          icon={<KnowledgeIcon />}
          className="w-full justify-start"
          onClick={() => navigate("/knowledge")}
        >
          {collapsed ? null : t("Common.Knowledge")}
        </Button>
      </div>
      <div className="px-1">
        <Button
          appearance="transparent"
          title="Alt+3"
          icon={<BookmarkMultipleIcon />}
          className="w-full justify-start"
          onClick={() => {
            navigate("/bookmarks");
          }}
        >
          {collapsed ? null : t("Common.Bookmarks")}
        </Button>
      </div>
      <div className={`px-1 ${collapsed ? "" : "flex flex-row  justify-between"}`}>
        <Button
          appearance="transparent"
          title="Mod+n"
          icon={<ChatAddIcon />}
          className="w-full mx-auto justify-start flex-grow"
          onClick={() => navigate("/conversation?id=4c1b1383-3481-47ff-b859-485b5decae27")}
        >
          {collapsed ? null : t("Chat.New")}
        </Button>
        <div>
          <Button
            appearance="transparent"
            icon={<FolderAddIcon />}
            onClick={async () => {
              const folder = await createFolder();
              selectFolder(folder.id);
            }}
          />
        </div>
      </div>
    </div>
  );
}
