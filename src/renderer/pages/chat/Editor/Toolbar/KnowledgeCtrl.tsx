import {
  Button,
  Combobox,
  type ComboboxProps,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Divider,
  Option,
} from "@fluentui/react-components";
import {
  bundleIcon,
  Dismiss24Regular,
  DismissCircle16Regular,
  Library20Filled,
  Library20Regular,
} from "@fluentui/react-icons";
import Debug from "debug";
import type { IChat, IChatContext } from "intellichat/types";
import Mousetrap from "mousetrap";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useChatKnowledgeStore from "stores/useChatKnowledgeStore";
import useKnowledgeStore from "stores/useKnowledgeStore";
import type { ICollection } from "types/knowledge";
import { useLiveCollections } from "@/renderer/next/hooks/remote/use-live-collections";

const debug = Debug("5ire:pages:chat:Editor:Toolbar:KnowledgeCtrl");

const KnowledgeIcon = bundleIcon(Library20Filled, Library20Regular);

/**
 * Knowledge control component that provides a dialog interface for managing knowledge collections
 * associated with a chat. Allows users to select and remove knowledge collections that will be
 * used as context for the chat conversation.
 *
 * @param {Object} props - Component properties
 * @param {IChatContext} props.ctx - Chat context object containing chat-related utilities
 * @param {IChat} props.chat - Current chat object
 * @param {boolean} props.disabled - Whether the control should be disabled
 * @returns {JSX.Element} The knowledge control component with dialog interface
 */
export default function KnowledgeCtrl({ ctx, chat, disabled }: { ctx: IChatContext; chat: IChat; disabled: boolean }) {
  const { t } = useTranslation();

  const [open, setOpen] = useState<boolean>(false);
  const [associatedCollections, setAssociatedCollections] = useState<typeof collections>([]);

  const getAssociatedCollections = useCallback(() => {
    window.bridge.documentManager.listAssociatedCollections({ type: "conversation", target: chat.id }).then((data) => {
      console.log(data);
      setAssociatedCollections(data);
    });
  }, [chat.id]);

  useEffect(() => {
    getAssociatedCollections();
  }, [getAssociatedCollections]);

  const collections = useLiveCollections().rows;

  /**
   * Closes the knowledge collections dialog and unbinds the escape key handler.
   * @returns {void}
   */
  const closeDialog = useCallback(() => {
    setOpen(false);
    Mousetrap.unbind("esc");
  }, []);

  const openDialog = useCallback(() => {
    setOpen(true);
    Mousetrap.bind("esc", closeDialog);
  }, [closeDialog]);

  useEffect(() => {
    Mousetrap.bind("mod+shift+3", openDialog);

    return () => {
      Mousetrap.unbind("mod+shift+3");
    };
  }, [openDialog]);

  const diff = (local: typeof collections, remote: typeof collections) => {
    const localIds = new Set(local.map((c) => c.id));
    const remoteIds = new Set(remote.map((c) => c.id));

    const added = local.filter((c) => !remoteIds.has(c.id));
    const removed = remote.filter((c) => !localIds.has(c.id));

    return { added, removed };
  };

  const handleChange = (ids: string[]) => {
    setAssociatedCollections(() => {
      return collections.filter((c) => ids.includes(c.id));
    });
  };

  const handleRemove = (id: string) => {
    setAssociatedCollections((prev) => {
      return prev.filter((c) => c.id !== id);
    });
  };

  const handleCloseDialog = () => {
    closeDialog();

    const local = associatedCollections;

    window.bridge.documentManager
      .listAssociatedCollections({ type: "conversation", target: chat.id })
      .then((remote) => {
        const { added, removed } = diff(local, remote);

        if (!added.length && !removed.length) {
          return;
        }

        const patches: Promise<unknown>[] = [];

        for (const collection of added) {
          patches.push(
            window.bridge.documentManager
              .associateCollection({
                type: "conversation",
                id: collection.id,
                target: chat.id,
              })
              .catch(),
          );
        }

        for (const collection of removed) {
          patches.push(
            window.bridge.documentManager
              .disassociateCollection({
                type: "conversation",
                id: collection.id,
                target: chat.id,
              })
              .catch(),
          );
        }

        return Promise.all(patches).finally(() => {
          getAssociatedCollections();
        });
      });
  };

  return (
    <div>
      <Dialog open={open}>
        <DialogTrigger disableButtonEnhancement>
          <Button
            disabled={disabled}
            size="small"
            title={t("Common.Knowledge") + "(Mod+Shift+3)"}
            aria-label={t("Common.Knowledge")}
            className={`justify-start text-color-secondary ${disabled ? "opacity-50" : ""}`}
            style={{
              padding: 1,
              minWidth: 20,
              borderColor: "transparent",
              boxShadow: "none",
            }}
            appearance="subtle"
            onClick={openDialog}
            icon={<KnowledgeIcon />}
          >
            {associatedCollections.length > 0 && associatedCollections.length}
          </Button>
        </DialogTrigger>
        <DialogSurface>
          <DialogBody>
            <DialogTitle
              action={
                <DialogTrigger action="close">
                  <Button
                    appearance="subtle"
                    aria-label="close"
                    onClick={handleCloseDialog}
                    icon={<Dismiss24Regular />}
                  />
                </DialogTrigger>
              }
            >
              {t("Knowledge.Collection")}
            </DialogTitle>
            <DialogContent>
              <div>
                <Combobox
                  className="w-full"
                  multiselect
                  placeholder="Select one or more knowledge collections"
                  onOptionSelect={(_, data) => handleChange(data.selectedOptions)}
                  selectedOptions={associatedCollections.map((c) => c.id)}
                >
                  {collections.map((collection) => (
                    <Option
                      key={collection.id}
                      value={collection.id}
                      text={collection.name}
                      disabled={collection.documents === 0}
                    >
                      <div className="flex justify-between items-center w-full">
                        <div>{collection.name}</div>
                        <div>{collection.documents} files</div>
                      </div>
                    </Option>
                  ))}
                </Combobox>
              </div>
              <div className="py-2 mt-2">
                <Divider>{t("Editor.Toolbar.KnowledgeCtrl.SelectedCollections")}</Divider>
              </div>
              <div className="min-h-28">
                {associatedCollections.map((collection) => (
                  <div className="my-1 py-1 px-2 rounded flex justify-between items-center" key={collection.id}>
                    <div className="flex justify-start gap-1">
                      <span className="font-semibold">{collection.name}</span>
                      <span className="inline-block ml-2">({collection.documents} files)</span>
                    </div>
                    <Button
                      icon={<DismissCircle16Regular />}
                      appearance="subtle"
                      onClick={() => handleRemove(collection.id)}
                    />
                  </div>
                ))}
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
