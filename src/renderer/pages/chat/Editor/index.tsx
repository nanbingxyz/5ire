import {
  KeyboardEvent,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import useChatStore from "stores/useChatStore";
import { useTranslation } from "react-i18next";
import { Button } from "@fluentui/react-components";
import { removeTagsExceptImg, setCursorToEnd } from "utils/util";
import { debounce } from "lodash";
import { IChatContext } from "intellichat/types";
import Spinner from "../../../components/Spinner";
import Toolbar from "./Toolbar";

/**
 * A rich text editor component for chat input with support for keyboard shortcuts,
 * image pasting, and toolbar integration.
 *
 * @param {Object} props - The component props
 * @param {IChatContext} props.ctx - The chat context object
 * @param {boolean} props.isReady - Whether the editor is ready for input
 * @param {function} props.onSubmit - Callback function called when submitting content
 * @param {function} props.onAbort - Callback function called when aborting generation
 * @returns {JSX.Element} The editor component
 */
export default function Editor({
  ctx,
  isReady,
  onSubmit,
  onAbort,
}: {
  ctx: IChatContext;
  isReady: boolean;
  onSubmit: (prompt: unknown) => Promise<void> | undefined;
  onAbort: () => void;
}) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const chat = useChatStore((state) => state.chat);
  const states = useChatStore().getCurState();
  const [submitted, setSubmitted] = useState<boolean>(false);
  const updateStates = useChatStore((state) => state.updateStates);
  const editStage = useChatStore((state) => state.editStage);
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  /**
   * Saves the current text selection range for later restoration.
   */
  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedRange(sel.getRangeAt(0));
    } else {
      setSavedRange(null);
    }
  }, [setSavedRange]);

  /**
   * Restores the previously saved text selection range.
   */
  const restoreRange = useCallback(() => {
    // 恢复选区
    if (savedRange) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
    }
  }, [savedRange]);

  /**
   * Debounced function to save editor input to the chat store.
   */
  const saveInput = useMemo(() => {
    return debounce(async (chatId: string) => {
      if (!submitted) {
        await editStage(chatId, { input: editorRef.current?.innerHTML });
      }
    }, 1000);
  }, [editStage]);

  /**
   * Handles editor blur event by saving the current selection range.
   */
  const onBlur = () => {
    saveRange();
  };

  /**
   * Inserts text at the current cursor position in the editor.
   *
   * @param {string} text - The text to insert
   */
  const insertText = useCallback((text: string) => {
    if (text === "\n") {
      document.execCommand("insertLineBreak");
    } else {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      selection.deleteFromDocument();
      selection.getRangeAt(0).insertNode(document.createTextNode(text));
      selection.collapseToEnd();
    }
  }, []);

  /**
   * Handles keyboard events for the editor, including Enter key submission
   * and line break insertion with modifier keys.
   *
   * @param {KeyboardEvent<HTMLDivElement>} event - The keyboard event
   */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter") {
        // void submit when using IME.
        if (event.keyCode !== 229) {
          // void submit when shiftKey, ctrlKey or metaKey is pressed.
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // even execCommand is deprecated, it seems to be the only way to insert a line break in contentEditable.
            document.execCommand("insertLineBreak");
            // scroll to bottom
            if (editorRef.current) {
              requestAnimationFrame(() => {
                editorRef.current?.scrollTo({
                  top: editorRef.current.scrollHeight,
                  behavior: "smooth",
                });
              });
            }
          } else {
            event.preventDefault();
            setSubmitted(true);
            onSubmit(removeTagsExceptImg(editorRef.current?.innerHTML || ""));
            // @ts-ignore
            editorRef.current.innerHTML = "";
            editStage(chat.id, { input: "" });
          }
        }
      }
    },
    [onSubmit, chat.id, editStage]
  );

  /**
   * Handles paste events to insert plain text and images without formatting.
   *
   * @param {ClipboardEvent} e - The clipboard event
   */
  const pasteWithoutStyle = useCallback((e: ClipboardEvent) => {
    e.preventDefault(); // 阻止默认粘贴行为
    if (!e.clipboardData) return;
    // @ts-expect-error clipboardData is not defined in types
    const clipboardItems = e.clipboardData.items || window.clipboardData;
    let text = "";
    Array.from(clipboardItems).forEach((item: DataTransferItem) => {
      if (item.kind === "string" && item.type === "text/plain") {
        item.getAsString(function (clipText) {
          let txt = clipText.replace(/&[a-z]+;/gi, " ");
          txt = txt.replace(/<\/(p|div|br|h[1-6])>/gi, "\n");
          txt = txt.replace(/\n+/g, "\n\n").trim();
          text += txt;
          insertText(text);
        });
      } else if (item.kind === "file" && item.type.startsWith("image/")) {
        // handle image paste
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = function (event) {
          const img = document.createElement("img");
          img.src = event.target?.result as string;
          if (editorRef.current) {
            editorRef.current.appendChild(img);
            const selection = window.getSelection();
            // move cursor after the image
            const range = document.createRange();
            range.setStartAfter(img);
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        };
        reader.readAsDataURL(file as Blob);
      }
    });
  }, []);

  /**
   * Handles input events by saving the input and resetting submission state.
   */
  const onInput = () => {
    saveInput(chat.id);
    setSubmitted(false);
  };

  useEffect(() => {
    setSubmitted(false);
    if (editorRef.current) {
      editorRef.current.addEventListener("paste", pasteWithoutStyle);
    }
    if (editorRef.current && chat.id) {
      editorRef.current.focus();
      const content = chat.input || "";
      if (content !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = content;
        setCursorToEnd(editorRef.current);
      }
    }
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener("paste", pasteWithoutStyle);
      }
    };
  }, [chat.id]);

  /**
   * Handles abort button click by calling onAbort and updating loading state.
   */
  const onAbortClick = () => {
    onAbort();
    updateStates(chat.id, { loading: false });
  };

  /**
   * Handles toolbar action confirmation by setting cursor to end of editor.
   */
  const onToolbarActionConfirm = () => {
    setTimeout(() => setCursorToEnd(editorRef.current as HTMLDivElement));
  };

  return (
    <div className="relative flex flex-col cursor-text editor">
      {states.loading ? (
        <div className="editor-loading-mask absolute flex flex-col justify-center items-center">
          <Button onClick={onAbortClick} className="flex items-center">
            <Spinner size={18} className="mr-2" />
            {t("Common.StopGenerating")}
          </Button>
        </div>
      ) : null}
      <Toolbar
        onConfirm={onToolbarActionConfirm}
        isReady={isReady}
        ctx={ctx}
        onTriggerPrompt={onSubmit}
      />
      {!isReady && (
        <div className="absolute top-[40px] max-w-md right-0 left-0 tips px-2.5">
          <p>{t("Notification.APINotReady")}</p>
        </div>
      )}
      <div
        contentEditable={isReady && !states.loading}
        role="textbox"
        aria-label="editor"
        aria-multiline="true"
        tabIndex={0}
        suppressContentEditableWarning
        id="editor"
        ref={editorRef}
        autoCorrect="on"
        className="w-full outline-0 px-2.5 pb-2.5 bg-brand-surface-1 overflow-y-auto overflow-x-hidden"
        onKeyDown={onKeyDown}
        onFocus={restoreRange}
        onBlur={onBlur}
        onInput={onInput}
        style={{
          resize: "none",
          minHeight: "60%",
          whiteSpace: "pre-wrap",
          opacity: isReady ? 1 : 0,
        }}
      />
      <div className="h-8 flex-shrink-0" />
    </div>
  );
}
