/* eslint-disable jsx-a11y/anchor-has-content */
/* eslint-disable react/no-danger */

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Divider,
} from "@fluentui/react-components";
import { ChevronDown16Regular, ChevronUp16Regular, Dismiss24Regular } from "@fluentui/react-icons";
import Debug from "debug";
import useECharts from "hooks/useECharts";
import useMarkdown from "hooks/useMarkdown";
import useToast from "hooks/useToast";
import type { IChatMessage, StructuredPrompt } from "intellichat/types";
import { debounce } from "lodash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ToolSpinner from "renderer/components/ToolSpinner";
import useChatStore from "stores/useChatStore";
import useKnowledgeStore from "stores/useKnowledgeStore";
import useMermaid from "../../../hooks/useMermaid";
import { getNormalContent, getReasoningContent, highlight } from "../../../utils/util";
import MCPPromptContentPreview from "./MCPPromptContentPreview";
import MessageToolbar from "./MessageToolbar";

const debug = Debug("5ire:pages:chat:Message");

export default function Message({ message, isReady }: { message: IChatMessage; isReady: boolean }) {
  const { t } = useTranslation();
  const { notifyInfo } = useToast();
  const keywords = useChatStore((state: any) => state.keywords);
  const states = useChatStore().getCurState();
  const { showCitation } = useKnowledgeStore();
  const { renderMermaid } = useMermaid();
  const { initECharts, disposeECharts } = useECharts({ message });

  const [deferredReply, setDeferredReply] = useState("");
  const [deferredReasoning, setDeferredReasoning] = useState("");
  const [isReasoning, setIsReasoning] = useState(false);
  const [reasoningSeconds, setReasoningSeconds] = useState(0);
  const [isReasoningShow, setIsReasoningShow] = useState(false);

  const reasoningInterval = useRef<number | null>(null);
  const hasStartedReasoning = useRef(false);

  const keyword = useMemo(() => keywords[message.chatId], [keywords, message.chatId]);

  const citedFiles = useMemo(() => JSON.parse(message.citedFiles || "[]"), [message.citedFiles]);

  const citedChunks = useMemo(() => JSON.parse(message.citedChunks || "[]"), [message.citedChunks]);

  const reply = useMemo(() => getNormalContent(message.reply), [message.reply]);

  const reasoning = useMemo(
    () => getReasoningContent(message.reply, message.reasoning),
    [message.reply, message.reasoning],
  );

  const { render } = useMarkdown();

  const onCitationClick = useCallback(
    (event: any) => {
      try {
        if (!event.target?.href) {
          event.preventDefault();
          return;
        }

        const url = new URL(event.target.href);
        if (url.pathname === "/citation" || url.protocol.startsWith("file:")) {
          event.preventDefault();
          const chunkId = url.hash.replace("#", "");
          const chunk = citedChunks.find((i: any) => i.id === chunkId);
          if (chunk) {
            showCitation(chunk.content);
          } else {
            notifyInfo(t("Knowledge.Notification.CitationNotFound"));
          }
        }
      } catch (error) {
        console.error("Citation click error:", error);
        event.preventDefault();
      }
    },
    [citedChunks, showCitation, t, notifyInfo],
  );

  const renderECharts = useCallback(
    (prefix: string, msgDom: Element) => {
      const charts = msgDom.querySelectorAll(".echarts-container");
      charts.forEach((chart) => {
        initECharts(prefix, chart.id);
      });
    },
    [initECharts],
  );

  const toggleThink = useCallback(() => {
    setIsReasoningShow(!isReasoningShow);
  }, [isReasoningShow]);

  const debouncedSetDeferredReply = useMemo(() => debounce((replyData: string) => setDeferredReply(replyData), 50), []);

  const debouncedSetDeferredReasoning = useMemo(
    () => debounce((reasoningData: string) => setDeferredReasoning(reasoningData), 50),
    [],
  );

  const updateDOM = useCallback(() => {
    const timer = setTimeout(() => {
      const messageContainer = document.getElementById(message.id);
      if (!messageContainer) return;

      const promptNode = messageContainer.querySelector(".msg-prompt");
      if (promptNode) {
        renderECharts("prompt", promptNode);
      }

      const replyNode = messageContainer.querySelector(".msg-reply");
      if (replyNode) {
        const links = replyNode.querySelectorAll("a");
        links.forEach((link) => {
          link.removeEventListener("click", onCitationClick);
          link.addEventListener("click", onCitationClick);
        });

        renderECharts("reply", replyNode);
        renderMermaid();
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [message.id, onCitationClick, renderECharts, renderMermaid]);

  // 推理状态监控
  const monitorReasoning = useCallback(() => {
    if (reasoningInterval.current) {
      clearInterval(reasoningInterval.current);
    }

    reasoningInterval.current = setInterval(() => {
      if (isReasoning && message.isActive) {
        setReasoningSeconds((prev) => prev + 1);
      }

      if (reply.trim() && isReasoning && message.isActive) {
        clearInterval(reasoningInterval.current as number);
        setIsReasoning(false);
        debug("Reasoning ended");
      }
    }, 1000) as any;
  }, [isReasoning, message.isActive, reply]);

  useEffect(() => {
    debouncedSetDeferredReply(reply);
    debouncedSetDeferredReasoning(reasoning);

    return () => {
      debouncedSetDeferredReply.cancel();
      debouncedSetDeferredReasoning.cancel();
    };
  }, [reply, reasoning, debouncedSetDeferredReply, debouncedSetDeferredReasoning]);

  useEffect(() => {
    if (reasoning && !hasStartedReasoning.current && message.isActive) {
      hasStartedReasoning.current = true;
      setIsReasoning(true);
      setIsReasoningShow(true);
      monitorReasoning();
    } else if (!reasoning) {
      hasStartedReasoning.current = false;
      setIsReasoning(false);
    }
  }, [reasoning, message.isActive, monitorReasoning]);

  useEffect(() => {
    if (!message.isActive) {
      hasStartedReasoning.current = false;
      setIsReasoning(false);
    }

    return () => {
      if (reasoningInterval.current) {
        clearInterval(reasoningInterval.current);
      }
      hasStartedReasoning.current = false;
      setIsReasoning(false);
    };
  }, [message.id, message.isActive]);

  useEffect(() => {
    const cleanup = updateDOM();
    return () => {
      cleanup();
      disposeECharts();
    };
  }, [message.id, message.isActive, updateDOM, disposeECharts]);

  const renderedContent = useMemo(() => {
    const isLoading = message.isActive && states.loading;

    const isEmpty = !message.reply && !message.reasoning;

    const isReasoningInProgress = isReasoning && !reply.trim();

    return {
      isLoading,
      isEmpty,
      thinkTitle: `${isReasoning ? t("Reasoning.Thinking") : t("Reasoning.Thought")}${reasoningSeconds > 0 ? ` ${reasoningSeconds}s` : ""}`,
      replyHTML: render(
        `${highlight(deferredReply, keyword) || ""}${
          isLoading && deferredReply ? '<span class="blinking-cursor" /></span>' : ""
        }`,
      ),
      reasoningHTML: render(
        `${highlight(deferredReasoning, keyword) || ""}${
          isReasoningInProgress && deferredReasoning ? '<span class="blinking-cursor" /></span>' : ""
        }`,
      ),
    };
  }, [
    message.isActive,
    states.loading,
    message.reply,
    message.reasoning,
    isReasoning,
    reasoningSeconds,
    t,
    render,
    deferredReply,
    deferredReasoning,
    keyword,
    reply,
  ]);

  const replyNode = () => (
    <div className={`w-full mt-1.5 ${renderedContent.isLoading ? "is-loading" : ""}`}>
      {!!message.isActive && !!states.runningTool && (
        <div className="flex flex-row justify-start items-center gap-1">
          <ToolSpinner size={20} style={{ marginBottom: "-1px" }} />
          <span>{states.runningTool.split("--")[1]}</span>
        </div>
      )}

      {renderedContent.isLoading && renderedContent.isEmpty ? (
        <>
          <span className="skeleton-box" style={{ width: "80%" }} />
          <span className="skeleton-box" style={{ width: "90%" }} />
        </>
      ) : (
        <div className="-mt-1">
          {reasoning.trim() && (
            <div className="think">
              <button onClick={toggleThink} type="button">
                <div className="think-header">
                  <span className="font-bold text-gray-400">{renderedContent.thinkTitle}</span>
                  <div className="text-gray-400 -mb-0.5">
                    {isReasoningShow ? <ChevronUp16Regular /> : <ChevronDown16Regular />}
                  </div>
                </div>
              </button>
              <div
                className="think-body"
                style={{ display: isReasoningShow ? "block" : "none" }}
                dangerouslySetInnerHTML={{
                  __html: renderedContent.reasoningHTML,
                }}
              />
            </div>
          )}
          <div
            lang="en"
            className="break-words hyphens-auto mt-1"
            dangerouslySetInnerHTML={{ __html: renderedContent.replyHTML }}
          />
        </div>
      )}
    </div>
  );

  const renderStructedPrompts = useCallback((messages: StructuredPrompt[]) => {
    return (
      <MCPPromptContentPreview
        messages={messages.map((m) => {
          return {
            role: m.role,
            content: m.raw.content[0],
          };
        })}
      />
    );
  }, []);

  return (
    <div className="leading-6 message" id={message.id}>
      <div>
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a id={`prompt-${message.id}`} aria-label={`prompt of message ${message.id}`} />
        <div className="msg-prompt my-2 flex flex-start" style={{ minHeight: "40px" }}>
          <div className="avatar flex-shrink-0 mr-2" />
          {message.structuredPrompts ? (
            <Dialog>
              <DialogTrigger>
                <div
                  className="mt-1 break-word text-indigo-800 dark:text-indigo-200"
                  dangerouslySetInnerHTML={{
                    __html: render(highlight(message.prompt, keyword) || ""),
                  }}
                />
              </DialogTrigger>
              <DialogSurface>
                <DialogBody>
                  <DialogTitle
                    action={
                      <DialogTrigger action="close">
                        <Button appearance="subtle" aria-label="close" icon={<Dismiss24Regular />} />
                      </DialogTrigger>
                    }
                  >
                    <div className="flex justify-start items-center gap-1 font-semibold font-sans">
                      {message.prompt.slice(1)}
                    </div>
                  </DialogTitle>
                  <DialogContent>
                    <div className="text-xs">{renderStructedPrompts(JSON.parse(message.structuredPrompts))}</div>
                  </DialogContent>
                </DialogBody>
              </DialogSurface>
            </Dialog>
          ) : (
            <div
              className="mt-1 break-word"
              dangerouslySetInnerHTML={{
                __html: render(highlight(message.prompt, keyword) || ""),
              }}
            />
          )}
        </div>
      </div>

      <div>
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a id={`#reply-${message.id}`} aria-label={`Reply ${message.id}`} />
        <div className="msg-reply mt-2 flex flex-start" style={{ minHeight: "40px" }}>
          <div className="avatar flex-shrink-0 mr-2" />
          {replyNode()}
        </div>

        {citedFiles.length > 0 && (
          <div className="message-cited-files mt-2">
            <div className="mt-4 mb-2">
              <Divider>{t("Common.References")}</Divider>
            </div>
            <ul>
              {citedFiles.map((file: string) => (
                <li className="text-gray-500" key={file}>
                  {file}
                </li>
              ))}
            </ul>
          </div>
        )}
        <MessageToolbar message={message} isReady={isReady} />
      </div>
    </div>
  );
}
