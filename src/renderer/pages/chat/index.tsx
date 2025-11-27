import Debug from 'debug';
import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TEMP_CHAT_ID } from 'consts';
import { ContentBlock as MCPContentBlock } from '@modelcontextprotocol/sdk/types.js';
import useToast from 'hooks/useToast';
import useToken from 'hooks/useToken';

import {
  IChat,
  IChatMessage,
  IChatRequestMessage,
  IChatResponseMessage,
  StructuredPrompt,
} from 'intellichat/types';
import { ContentBlockConverter as MCPContentBlockConverter } from 'intellichat/mcp/ContentBlockConverter';
import { UnsupportedError as MCPUnsupportedError } from 'intellichat/mcp/UnsupportedError';
import INextChatService from 'intellichat/services/INextCharService';
import { ICollectionFile } from 'types/knowledge';

import useChatStore from 'stores/useChatStore';
import useChatKnowledgeStore from 'stores/useChatKnowledgeStore';
import useKnowledgeStore from 'stores/useKnowledgeStore';

import SplitPane, { Pane } from 'split-pane-react';
import Empty from 'renderer/components/Empty';

import useUI from 'hooks/useUI';
import useUsageStore from 'stores/useUsageStore';
import useNav from 'hooks/useNav';
import { debounce } from 'lodash';
import { isBlank } from 'utils/validators';
import {
  extractCitationIds,
  getNormalContent,
  getReasoningContent,
} from 'utils/util';
import useAppearanceStore from 'stores/useAppearanceStore';
import createService from 'intellichat/services';
import eventBus from 'utils/bus';
import { createChatContext } from '../../ChatContext';
import Header from './Header';
import Messages from './Messages';
import Editor from './Editor';
import Sidebar from './Sidebar/Sidebar';
import CitationDialog from './CitationDialog';

import './Chat.scss';
import 'split-pane-react/esm/themes/default.css';
import '../../../assets/css/katex.min.css';
import '../../../assets/css/texmath.min.css';

const debug = Debug('5ire:pages:chat');

const MemoizedMessages = React.memo(Messages);

const DEFAULT_SIDEBAR_WIDTH = 250;

type TriggerPrompt =
  | string
  | {
      name: string;
      source: string;
      description?: string;
      messages: { role: string; content: MCPContentBlock }[];
    };

export default function Chat() {
  const { t } = useTranslation();
  const id = useParams().id || TEMP_CHAT_ID;
  const anchor = useParams().anchor || null;
  const bus = useRef(eventBus);
  const navigate = useNav();
  const { heightStyle } = useUI();
  const [activeChatId, setActiveChatId] = useState(id);
  if (activeChatId !== id) {
    setActiveChatId(id);
    debug('Set chat id:', id);
  }

  const chatContext = useMemo(() => {
    return createChatContext(activeChatId);
  }, [activeChatId]);

  const [verticalSizes, setVerticalSizes] = useState(['auto', 200]);
  const [horizontalSizes, setHorizontalSizes] = useState(['auto', 0]);
  const ref = useRef<HTMLDivElement>(null);
  const folder = useChatStore((state) => state.folder);
  const keywords = useChatStore((state) => state.keywords);
  const messages = useChatStore((state) => state.messages);
  const setKeyword = useChatStore((state) => state.setKeyword);
  const tempStage = useChatStore((state) => state.tempStage);
  const provider = useChatStore((state) => state.chat.provider);
  const model = useChatStore((state) => state.chat.model);

  const {
    fetchMessages,
    initChat,
    getChat,
    updateChat,
    updateStates,
    getCurFolderSettings,
    openFolder,
  } = useChatStore();

  const chatSidebarShow = useAppearanceStore((state) => state.chatSidebar.show);
  const chatService = useRef<INextChatService>();

  // The ready state depends only on the status of the model and the provider.
  // When the model or provider changes, call chatContext.isReady() to get the ready state.
  const readySignature = `${provider ?? ''}:${model ?? ''}`;
  const isReady = useMemo(() => {
    return chatContext.isReady();
  }, [chatContext, readySignature]);

  const [isLoading, setIsLoading] = useState(false);

  const { notifyError } = useToast();

  const isUserScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  const scrollToBottom = useRef(
    debounce(
      () => {
        if (ref.current) {
          ref.current.scrollTop = ref.current.scrollHeight;
        }
      },
      100,
      { leading: true, maxWait: 300 },
    ),
  ).current;

  const handleScroll = useRef(
    debounce(
      () => {
        if (ref.current) {
          const { scrollTop, scrollHeight, clientHeight } = ref.current;
          const atBottom = scrollTop + clientHeight >= scrollHeight - 50;
          if (scrollTop > lastScrollTopRef.current) {
            if (atBottom) {
              isUserScrollingRef.current = false;
            }
          } else {
            isUserScrollingRef.current = true;
            scrollToBottom.cancel();
          }
          lastScrollTopRef.current = scrollTop;
        }
      },
      300,
      { leading: true, maxWait: 500 },
    ),
  ).current;

  useEffect(() => {
    const currentRef = ref.current;
    currentRef?.addEventListener('scroll', handleScroll);
    return () => {
      currentRef?.removeEventListener('scroll', handleScroll);
      isUserScrollingRef.current = false;
    };
  }, [handleScroll]);

  useEffect(() => {
    const initializeChat = async () => {
      setIsLoading(true);
      try {
        if (activeChatId !== TEMP_CHAT_ID) {
          return await getChat(activeChatId);
        }
        if (folder) {
          return initChat(getCurFolderSettings());
        }
        return initChat(tempStage);
      } finally {
        setIsLoading(false);
      }
    };
    initializeChat();
    return () => {
      isUserScrollingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  const debouncedFetchMessages = useMemo(
    () =>
      debounce(
        async (chatId: string, keyword: string) => {
          await fetchMessages({ chatId, keyword });
          debug('Fetch chat messages, chatId:', chatId, ', keyword:', keyword);
        },
        400,
        {
          leading: true,
          maxWait: 2000,
        },
      ),
    [fetchMessages],
  );

  useEffect(() => {
    const loadMessages = async () => {
      const keyword = keywords[activeChatId] || '';
      await debouncedFetchMessages(activeChatId, keyword);
      if (anchor) {
        setTimeout(() => {
          const anchorDom = document.getElementById(anchor);
          anchorDom?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 500);
      } else {
        scrollToBottom();
      }
    };
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, debouncedFetchMessages, keywords]);

  useEffect(() => {
    if (chatSidebarShow) {
      setHorizontalSizes(['auto', DEFAULT_SIDEBAR_WIDTH]);
    } else {
      setHorizontalSizes(['auto', 0]);
    }
  }, [chatSidebarShow]);

  const verticalSashRender = () => <div className="border-t border-base" />;
  const horizontalSashRender = () => <div className="border-l border-base" />;

  const { createMessage, createChat, deleteStage, updateMessage, appendReply } =
    useChatStore();

  const { countInput, countOutput, countBlobInput } = useToken();

  const { moveChatCollections, listChatCollections, setChatCollections } =
    useChatKnowledgeStore.getState();

  const onSubmit = useCallback(
    async (prompt: unknown, msgId?: string) => {
      chatService.current = createService(chatContext);

      if (!chatService.current) {
        return;
      }

      const triggerPrompt = prompt as TriggerPrompt;

      if (typeof triggerPrompt === 'string' && triggerPrompt.trim() === '') {
        return;
      }

      if (
        typeof triggerPrompt !== 'string' &&
        triggerPrompt.messages.length === 0
      ) {
        return;
      }

      const providerCtx = chatContext.getProvider();
      const modelCtx = chatContext.getModel();
      const temperature = chatContext.getTemperature();
      const maxTokens = chatContext.getMaxTokens();
      let currentChat = chatContext.getActiveChat();

      let abortController: AbortController | undefined;

      if (
        'abortController' in chatService.current &&
        chatService.current.abortController instanceof AbortController
      ) {
        abortController = chatService.current.abortController;
      }

      let $chatId = activeChatId;

      const summary =
        typeof triggerPrompt === 'string'
          ? triggerPrompt.substring(0, 50)
          : `${triggerPrompt.name}${triggerPrompt.description ? ` (${triggerPrompt.description})` : ''}`;

      if (activeChatId === TEMP_CHAT_ID) {
        const $chat = await createChat(
          {
            summary,
            provider: providerCtx.name,
            model: modelCtx.name,
            temperature,
            folderId: folder?.id || null,
          },
          async (newChat: IChat) => {
            const knowledgeCollections = moveChatCollections(
              TEMP_CHAT_ID,
              newChat.id,
            );
            await setChatCollections(newChat.id, knowledgeCollections);
          },
        );
        $chatId = $chat.id;
        setActiveChatId($chatId);
        navigate(`/chats/${$chatId}`);
        if (folder) {
          openFolder(folder.id);
        }
        deleteStage(TEMP_CHAT_ID);
        currentChat = $chat;
      } else {
        if (!msgId) {
          const shouldUpdateProvider =
            !currentChat.provider || currentChat.provider === providerCtx.name;
          const shouldUpdateModel =
            !currentChat.model || currentChat.model === modelCtx.name;

          if (shouldUpdateProvider && shouldUpdateModel) {
            await updateChat({
              id: activeChatId,
              provider: providerCtx.name,
              model: modelCtx.name,
              temperature,
              summary,
            });
          } else {
            await updateChat({
              id: activeChatId,
              temperature,
              summary,
            });
          }
        }
        currentChat = chatContext.getActiveChat();
        setKeyword(activeChatId, ''); // clear filter keyword
      }
      updateStates($chatId, { loading: true });
      const providerNameForMessage = currentChat?.provider || providerCtx.name;
      const modelNameForMessage = currentChat?.model || modelCtx.name;

      const msg = msgId
        ? (messages.find((message) => msgId === message.id) as IChatMessage)
        : await useChatStore.getState().createMessage({
            prompt:
              typeof triggerPrompt === 'string'
                ? triggerPrompt
                : `/${triggerPrompt.name}`,
            structuredPrompts: typeof triggerPrompt === 'string' ? null : '[]',
            reply: '',
            chatId: $chatId,
            model: modelNameForMessage,
            temperature,
            maxTokens,
            isActive: 1,
          });

      const convertedMCPTriggerPrompt =
        typeof triggerPrompt === 'string'
          ? undefined
          : {
              name: triggerPrompt.name,
              description: triggerPrompt.description,
              messages: [] as Array<StructuredPrompt>,
            };

      if (typeof triggerPrompt !== 'string') {
        try {
          const convertedMessages = await Promise.all(
            triggerPrompt.messages.map<Promise<StructuredPrompt>>(
              async (message) => {
                const converted = await MCPContentBlockConverter.convert(
                  message.content,
                  async (uri) => {
                    return window.electron.mcp
                      .readResource(triggerPrompt.source, uri)
                      .then((result) => {
                        if (result.isError) {
                          return [];
                        }

                        return result.contents;
                      });
                  },
                );

                return {
                  role: message.role as 'user',
                  content: [
                    MCPContentBlockConverter.contentBlockToLegacyMessageContent(
                      converted,
                    ),
                  ],
                  raw: {
                    type: 'mcp-prompts',
                    prompt: {
                      name: triggerPrompt.name,
                      description: triggerPrompt.description,
                      source: triggerPrompt.source,
                    },
                    content: [message.content],
                    convertedContent: [converted],
                  },
                };
              },
            ),
          );
          convertedMCPTriggerPrompt!.messages = convertedMessages;
        } catch (error) {
          if (MCPUnsupportedError.isInstance(error)) {
            notifyError(t('Tools.UnsupportedCapability'));
            return;
          }

          throw error;
        }
      }

      if (abortController?.signal.aborted) {
        return;
      }

      await updateMessage({
        id: msg.id,
        reply: '',
        reasoning: '',
        model: modelNameForMessage,
        temperature,
        maxTokens,
        isActive: 1,
        citedFiles: '[]',
        citedChunks: '[]',
        structuredPrompts: convertedMCPTriggerPrompt
          ? JSON.stringify(convertedMCPTriggerPrompt.messages)
          : null,
      });

      if (!msgId) {
        scrollToBottom();
      }

      // Knowledge Collections
      let knowledgeChunks = [];
      let files: ICollectionFile[] = [];
      let actualPrompt = typeof triggerPrompt === 'string' ? triggerPrompt : '';
      const chatCollections = await listChatCollections($chatId);
      if (chatCollections.length) {
        const knowledgeString = await window.electron.knowledge.search(
          chatCollections.map((c) => c.id),
          typeof triggerPrompt === 'string'
            ? triggerPrompt
            : triggerPrompt.description || '',
        );
        knowledgeChunks = JSON.parse(knowledgeString);
        useKnowledgeStore.getState().cacheChunks(knowledgeChunks);
        const filesId = [
          ...new Set<string>(knowledgeChunks.map((k: any) => k.fileId)),
        ];
        files = await useKnowledgeStore.getState().getFiles(filesId);
        actualPrompt = `
# Context #
Please read carefully and use the following context information in JSON format to answer questions.
The context format is {"seqNo": number, "id": "id", "file":"fileName", "content": "content"}.
When using context information in your response, output the reference as \`[(<seqNo>)](citation#<id> '<file>')\` strictly after the relevant content.
---------------------------------------------------
For example:
the context information is: {"seqNo": 1, "id": "432939KFD83242", "file":"Fruit Encyclopedia", "content": "apples are one of common fruit"}.
and the question is: "What are some common fruits?".
The answer should be:
"According to the information provided, apples are a common fruit [(1)](citation#432939KFD83242 'Fruit Encyclopedia')."
---------------------------------------------------
Ensure that the context information is accurately referenced, and label it as [(<seqNo>)](citation#<id> '<file>') when a piece of information is actually used.
${JSON.stringify(
  knowledgeChunks.map((k: any, idx: number) => ({
    seqNo: idx + 1,
    file: files.find((f) => f.id === k.fileId)?.name,
    id: k.id,
    content: k.content,
  })),
)}

# Objective #
${prompt}
`;
      }

      if (abortController?.signal.aborted) {
        return;
      }

      const onChatComplete = async (result: IChatResponseMessage) => {
        /**
         * 异常分两种情况，一种是有输出， 但没有正常结束； 一种是没有输出
         * 异常且没有输出，则只更新 isActive 为 0
         */
        if (
          result.error &&
          isBlank(result.content) &&
          isBlank(result.reasoning)
        ) {
          await updateMessage({
            id: msg.id,
            isActive: 0,
          });
        } else {
          let { inputTokens } = result;

          if (!inputTokens) {
            inputTokens = 0;

            if (typeof triggerPrompt === 'string') {
              inputTokens += await countInput(actualPrompt);
            } else {
              inputTokens += convertedMCPTriggerPrompt!.messages.reduce(
                (prev, message) => {
                  return (
                    prev +
                    message.content.reduce((value, item) => {
                      let num = value;

                      if (item.source) {
                        if (item.source.media_type.startsWith('image/')) {
                          num += countBlobInput(item.source.data, 'image');
                        }

                        if (item.source.media_type.startsWith('audio/')) {
                          num += countBlobInput(item.source.data, 'audio');
                        }
                      }

                      if (item.image_url?.url) {
                        if (item.image_url.url.startsWith('data:')) {
                          num += countBlobInput(
                            item.image_url.url.split(',')[1],
                            'image',
                          );
                        }
                      }

                      if (item.images) {
                        item.images.forEach((image) => {
                          if (image.startsWith('data:')) {
                            num += countBlobInput(image.split(',')[1], 'image');
                          }
                        });
                      }

                      return num;
                    }, 0)
                  );
                },
                0,
              );
              inputTokens += await countInput(
                convertedMCPTriggerPrompt!.messages.reduce((text, message) => {
                  return (
                    text +
                    message.content
                      .map((item) => {
                        return item.text || '';
                      })
                      .join(' ')
                  );
                }, ''),
              );
            }
          }

          // const inputTokens = result.inputTokens || (await countInput(prompt));
          const outputTokens =
            result.outputTokens || (await countOutput(result.content || ''));
          const citedChunkIds = extractCitationIds(result.content || '');
          const citedChunks = knowledgeChunks.filter((k: any) =>
            citedChunkIds.includes(k.id),
          );
          const citedFileIds = [
            ...new Set(citedChunks.map((k: any) => k.fileId)),
          ];
          const citedFiles = files.filter((f) => citedFileIds.includes(f.id));
          await updateMessage({
            id: msg.id,
            reply: getNormalContent(result.content as string),
            reasoning: getReasoningContent(
              result.content as string,
              result.reasoning,
            ),
            inputTokens,
            outputTokens,
            isActive: 0,
            citedFiles: JSON.stringify(citedFiles.map((f) => f.name)),
            citedChunks: JSON.stringify(
              citedChunks.map((k: any, idx: number) => ({
                seqNo: idx + 1,
                content: k.content,
                id: k.id,
              })),
            ),
          });
          useUsageStore.getState().create({
            provider: providerNameForMessage,
            model: modelNameForMessage,
            inputTokens,
            outputTokens,
          });
        }
        updateStates($chatId, { loading: false, runningTool: null });
      };
      chatService.current.onComplete(onChatComplete);
      chatService.current.onReading((content: string, reasoning?: string) => {
        appendReply(msg.id, content || '', reasoning || '');
        if (!isUserScrollingRef.current) {
          scrollToBottom();
        }
      });
      chatService.current.onToolCalls((toolName: string) => {
        updateStates($chatId, { runningTool: toolName });
      });
      chatService.current.onError(async (err: any, aborted: boolean) => {
        debug('Chat service error:', err);
        if (!aborted) {
          notifyError(err.message || err.error);
        }
        await updateMessage({
          id: msg.id,
          isActive: 0,
        });
        updateStates($chatId, { loading: false });
      });

      await chatService.current.chat(
        [
          {
            role: 'user',
            content: actualPrompt,
          },

          ...(convertedMCPTriggerPrompt?.messages || []).map(
            (message): IChatRequestMessage => {
              return {
                role: message.role as 'user' | 'assistant',
                content: message.content,
              };
            },
          ),
        ],
        msgId,
      );
      window.electron.ingestEvent([
        { app: 'chat' },
        { provider: providerNameForMessage, model: modelNameForMessage },
      ]);
    },
    [
      activeChatId,
      messages,
      createMessage,
      scrollToBottom,
      createChat,
      updateChat,
      setKeyword,
      countInput,
      countOutput,
      countBlobInput,
      updateMessage,
      navigate,
      appendReply,
      notifyError,
      chatContext,
      deleteStage,
      folder,
      moveChatCollections,
      setChatCollections,
      openFolder,
      listChatCollections,
      t,
      updateStates,
    ],
  );

  useEffect(() => {
    const eventBusRef = bus.current;

    const handleRetry = async (event: any) => {
      const message = event as IChatMessage;

      if (message.structuredPrompts) {
        const prompts = JSON.parse(
          message.structuredPrompts,
        ) as Array<StructuredPrompt>;

        const prompt = {
          name: message.prompt.startsWith('/')
            ? message.prompt.slice(1)
            : message.prompt,
          messages: prompts.map((msg) => {
            return {
              role: msg.role,
              content: msg.raw.content[0],
            };
          }),
        };

        onSubmit(prompt, message.id);
      } else {
        onSubmit(message.prompt, message.id);
      }

      // console.log('message', event);
      // await onSubmit(event.prompt, event.msgId);
    };

    // Listen for startup submit events
    const handleStartupSubmit = async (prompt: string) => {
      debug('Received startup-submit event with prompt:', prompt);
      await onSubmit(prompt);
    };

    eventBusRef.on('retry', handleRetry);
    eventBusRef.on('startup-submit', handleStartupSubmit);

    return () => {
      eventBusRef.off('retry', handleRetry);
      eventBusRef.off('startup-submit', handleStartupSubmit);
    };
  }, [onSubmit]);

  return (
    <div
      id="chat"
      className="relative  flex flex-start -mx-5 "
      style={{
        height: heightStyle(),
      }}
    >
      <SplitPane
        split="vertical"
        sizes={horizontalSizes}
        onChange={setHorizontalSizes}
        sashRender={horizontalSashRender}
      >
        <div>
          <Header />
          <div
            className=" mt-10"
            style={{
              height: heightStyle(),
            }}
          >
            <SplitPane
              split="horizontal"
              sizes={verticalSizes}
              onChange={setVerticalSizes}
              performanceMode
              sashRender={verticalSashRender}
            >
              <Pane className="chat-content flex-grow">
                <div id="messages" ref={ref} className="overflow-y-auto h-full">
                  {messages.length ? (
                    <div className="mx-auto max-w-screen-md px-5">
                      <MemoizedMessages messages={messages} isReady={isReady} />
                    </div>
                  ) : (
                    isReady || (
                      <Empty
                        image="hint"
                        text={t('Notification.APINotReady')}
                      />
                    )
                  )}
                </div>
              </Pane>
              <Pane minSize={180} maxSize="60%">
                {!isLoading && (
                  <Editor
                    ctx={chatContext}
                    isReady={isReady}
                    onSubmit={onSubmit}
                    onAbort={() => {
                      chatService.current?.abort();
                    }}
                  />
                )}
              </Pane>
            </SplitPane>
          </div>
        </div>
        <Pane
          className="right-sidebar border-l -mr-5"
          maxSize="45%"
          minSize={200}
        >
          <Sidebar chatId={activeChatId} />
        </Pane>
      </SplitPane>
      <CitationDialog />
    </div>
  );
}
