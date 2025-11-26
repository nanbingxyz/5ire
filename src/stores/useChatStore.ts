import Debug from 'debug';
import { create } from 'zustand';
import { typeid } from 'typeid-js';
import { produce } from 'immer';
import {
  isNil,
  isNull,
  isNumber,
  isPlainObject,
  isString,
  isUndefined,
  pick,
} from 'lodash';
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_PROVIDER,
  DEFAULT_TEMPERATURE,
  NUM_CTX_MESSAGES,
  TEMP_CHAT_ID,
} from 'consts';
import { date2unix } from 'utils/util';
import { isBlank, isNotBlank } from 'utils/validators';
import {
  IChat,
  IChatFolder,
  IChatMessage,
  IPrompt,
  IStage,
} from 'intellichat/types';
import { isValidTemperature } from 'intellichat/validators';
import { captureException } from '../renderer/logging';

const debug = Debug('5ire:stores:useChatStore');

const defaultTempStage = {
  provider: '',
  model: '',
  systemMessage: '',
  prompt: null,
  input: '',
  maxTokens: DEFAULT_MAX_TOKENS,
  maxCtxMessages: NUM_CTX_MESSAGES,
};
let tempStage = window.electron.store.get('stage', defaultTempStage);
if (!isPlainObject(tempStage)) {
  tempStage = defaultTempStage;
} else {
  tempStage = pick(tempStage, Object.keys(defaultTempStage));
}
export interface IChatStore {
  openFolders: string[];
  folders: Record<string, IChatFolder>;
  folder: IChatFolder | null;
  chats: IChat[];
  chat: {
    id: string;
  } & Partial<IChat>;
  messages: IChatMessage[];
  keywords: { [key: string]: string };
  states: {
    [key: string]: {
      loading: boolean;
      runningTool: string;
    };
  };
  tempStage: Partial<IStage>;
  setOpenFolders: (folders: string[]) => void;
  openFolder: (id: string) => void;
  fetchFolder: (limit?: number) => Promise<Record<string, IChatFolder>>;
  selectFolder: (id: string | null) => void;
  createFolder: (name?: string) => Promise<IChatFolder>;
  updateFolder: (
    folder: { id: string } & Partial<IChatFolder>,
  ) => Promise<boolean>;
  deleteFolder: (id: string) => Promise<boolean>;
  getCurFolderSettings: () => Partial<IChatFolder>;
  markFolderAsOld: (id: string) => void;
  updateStates: (
    chatId: string,
    states: { loading?: boolean; runningTool?: string | null },
  ) => void;
  getKeyword: (chatId: string) => string;
  setKeyword: (chatId: string, keyword: string) => void;
  // chat
  initChat: (chat: Partial<IChat>) => IChat;
  editChat: (chat: Partial<IChat>) => IChat;
  createChat: (
    chat: Partial<IChat>,
    beforeSetCallback?: (chat: IChat) => Promise<void>,
  ) => Promise<IChat>;
  updateChat: (chat: { id: string } & Partial<IChat>) => Promise<boolean>;
  deleteChat: (chatId?: string) => Promise<boolean>;
  fetchChats: (limit?: number) => Promise<IChat[]>;
  getChat: (id: string) => Promise<IChat>;
  fetchChat: (id: string) => Promise<IChat>;
  // message
  createMessage: (message: Partial<IChatMessage>) => Promise<IChatMessage>;
  appendReply: (chatId: string, reply: string, reasoning: string) => void;
  updateMessage: (
    message: { id: string } & Partial<IChatMessage>,
  ) => Promise<boolean>;
  bookmarkMessage: (id: string, bookmarkId: string | null) => void;
  deleteMessage: (id: string) => Promise<boolean>;
  getCurState: () => { loading: boolean; runningTool: string };
  fetchMessages: ({
    chatId,
    limit,
    offset,
    keyword,
  }: {
    chatId: string;
    limit?: number;
    offset?: number;
    keyword?: string;
  }) => Promise<IChatMessage[]>;
  editStage: (chatId: string, stage: Partial<IStage>) => Promise<void>;
  deleteStage: (chatId: string) => void;
}

const useChatStore = create<IChatStore>((set, get) => ({
  folders: {},
  openFolders: [],
  folder: null,
  keywords: {},
  chats: [],
  chat: { id: TEMP_CHAT_ID, ...tempStage },
  messages: [],
  states: {},
  // only for temp chat
  tempStage,
  setOpenFolders: (folders) => {
    set({ openFolders: folders });
  },
  openFolder: (id: string) => {
    set(
      produce((state: IChatStore) => {
        if (!state.openFolders.includes(id)) {
          state.openFolders.push(id);
        }
      }),
    );
  },
  fetchFolder: async (limit = 100) => {
    const offset = 0;
    const rows = (await window.electron.db.all(
      'SELECT id, name, provider, model, systemMessage, temperature, maxTokens, knowledgeCollectionIds, maxCtxMessages FROM folders ORDER BY name ASC  limit ? offset ?',
      [limit, offset],
    )) as IChatFolder[];
    const folders = rows.reduce(
      (acc, folder) => {
        acc[folder.id] = folder;
        return acc;
      },
      {} as Record<string, IChatFolder>,
    );
    set({ folders });
    return folders;
  },
  selectFolder: (id: string | null) => {
    if (!id) {
      set({ folder: null });
    } else {
      set((state) => ({ folder: state.folders[id] || null }));
    }
  },
  markFolderAsOld: (id: string) => {
    set(
      produce((state: IChatStore) => {
        if (state.folders[id]) {
          state.folders[id].isNew = false;
        }
      }),
    );
  },
  createFolder: async (name = 'New Folder') => {
    const folder = {
      id: typeid('dir').toString(),
      name,
      createdAt: date2unix(new Date()),
    } as IChatFolder;
    const ok = await window.electron.db.run(
      `INSERT INTO folders (id, name, createdAt) VALUES (?, ?, ?)`,
      [folder.id, folder.name, folder.createdAt],
    );
    if (!ok) {
      throw new Error('Write the folder into database failed');
    }
    folder.isNew = true;
    set(
      produce((state: IChatStore) => {
        state.folders[folder.id] = folder;
      }),
    );
    return folder;
  },
  deleteFolder: async (id: string) => {
    let ok = await window.electron.db.run(`DELETE FROM folders WHERE id = ?`, [
      id,
    ]);
    if (!ok) {
      throw new Error('Delete folder failed');
    }
    ok = await window.electron.db.run(`DELETE FROM chats WHERE folderId = ?`, [
      id,
    ]);
    set(
      produce((state: IChatStore) => {
        delete state.folders[id];
        state.chats = state.chats.filter((chat) => chat.folderId !== id);
        if (state.folder?.id === id) {
          state.folder = null;
        }
      }),
    );
    return ok;
  },
  updateFolder: async (folder: { id: string } & Partial<IChatFolder>) => {
    const $folder = { id: folder.id } as IChatFolder;
    const stats: string[] = [];
    const params: (string | number)[] = [];
    if (isNotBlank(folder.name)) {
      stats.push('name = ?');
      $folder.name = folder.name as string;
      params.push($folder.name);
    }
    if (isNotBlank(folder.provider)) {
      stats.push('provider = ?');
      $folder.provider = folder.provider as string;
      params.push($folder.provider);
    }
    if (isNotBlank(folder.model)) {
      stats.push('model = ?');
      $folder.model = folder.model as string;
      params.push($folder.model);
    }
    if (isNotBlank(folder.systemMessage)) {
      stats.push('systemMessage = ?');
      $folder.systemMessage = folder.systemMessage as string;
      params.push($folder.systemMessage);
    }
    if (isNumber(folder.temperature)) {
      stats.push('temperature = ?');
      $folder.temperature = folder.temperature as number;
      params.push($folder.temperature);
    }
    if (isNumber(folder.maxTokens)) {
      stats.push('maxTokens = ?');
      $folder.maxTokens = folder.maxTokens as number;
      params.push($folder.maxTokens);
    }
    if (isNumber(folder.maxCtxMessages)) {
      stats.push('maxCtxMessages = ?');
      $folder.maxCtxMessages = folder.maxCtxMessages as number;
      params.push($folder.maxCtxMessages);
    }
    if (folder.id && stats.length) {
      params.push($folder.id);
      await window.electron.db.run(
        `UPDATE folders SET ${stats.join(', ')} WHERE id = ?`,
        params,
      );
      set(
        produce((state: IChatStore) => {
          state.folders[$folder.id] = {
            ...state.folders[$folder.id],
            ...$folder,
          };
        }),
      );
      debug('Update folder ', JSON.stringify($folder));
      return true;
    }
    return false;
  },
  getCurFolderSettings: () => {
    const { folder } = get();
    const settings: any = { folderId: folder?.id || null };
    if (folder?.provider) {
      settings.provider = folder.provider;
    }
    if (folder?.model) {
      settings.model = folder.model;
    }
    if (folder?.systemMessage) {
      settings.systemMessage = folder.systemMessage;
    }
    if (isNumber(folder?.temperature)) {
      settings.temperature = folder.temperature;
    }
    return settings;
  },
  updateStates: (
    chatId: string,
    states: { loading?: boolean; runningTool?: string | null },
  ) => {
    set(
      produce((state: IChatStore) => {
        state.states[chatId] = Object.assign(
          state.states[chatId] || {},
          states,
        );
      }),
    );
  },
  getCurState: () => {
    const { chat, states } = get();
    return states[chat.id] || {};
  },
  getKeyword: (chatId: string) => {
    return get().keywords[chatId] || '';
  },
  setKeyword: (chatId: string, keyword: string) => {
    set(
      produce((state: IChatStore) => {
        state.keywords[chatId] = keyword;
      }),
    );
  },
  initChat: (chat: Partial<IChat>) => {
    const $chat = {
      provider: '',
      model: '',
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: null,
      maxCtxMessages: NUM_CTX_MESSAGES,
      id: TEMP_CHAT_ID,
      ...get().tempStage,
      ...chat,
    } as IChat;
    debug('Init a chat', $chat);
    set({ chat: $chat, messages: [] });
    return $chat;
  },
  editChat: (chat: Partial<IChat>) => {
    const $chat = { ...get().chat } as IChat;
    if (isString(chat.summary)) {
      $chat.summary = chat.summary as string;
    }
    if (isNotBlank(chat.provider)) {
      $chat.provider = chat.provider as string;
    }
    if (isNotBlank(chat.model)) {
      $chat.model = chat.model as string;
    }
    if (!isNil(chat.systemMessage)) {
      $chat.systemMessage = chat.systemMessage as string;
    }
    if (isNumber(chat.maxCtxMessages) && chat.maxCtxMessages >= 0) {
      $chat.maxCtxMessages = chat.maxCtxMessages;
    }
    if (
      isValidTemperature(chat.temperature, chat.provider || DEFAULT_PROVIDER)
    ) {
      $chat.temperature = chat.temperature;
    }
    if (isNumber(chat.maxTokens) && chat.maxTokens > 0) {
      $chat.maxTokens = chat.maxTokens;
    }
    if (!isUndefined(chat.prompt)) {
      $chat.prompt = (chat.prompt as IPrompt) || null;
    }
    $chat.input = chat.input || '';
    $chat.stream = isNil(chat.stream) ? true : chat.stream;
    set(
      produce((state: IChatStore) => {
        state.chat = { ...state.chat, ...$chat };
      }),
    );
    console.log('Edit chat', $chat);
    return $chat;
  },
  createChat: async (
    chat: Partial<IChat>,
    beforeSetCallback?: (chat: IChat) => Promise<void>,
  ) => {
    // Start with current chat state but allow explicit null/empty values to override
    const currentChat = get().chat;
    const $chat = {
      ...currentChat,
      ...chat,
      id: typeid('chat').toString(),
      createdAt: date2unix(new Date()),
      // Ensure provider/model from chat arg override current state even if empty string
      provider: chat.provider !== undefined ? chat.provider : currentChat.provider,
      model: chat.model !== undefined ? chat.model : currentChat.model,
    } as IChat;
    debug('Create a chat ', $chat);
    let prompt = null;
    $chat.input = ''; // clear input
    try {
      prompt = $chat.prompt ? JSON.stringify($chat.prompt) : null;
    } catch (err: any) {
      captureException(err);
    }
    let stream = 1;
    if (!isNil(chat.stream) && !chat.stream) {
      stream = 0;
    }
    const ok = await window.electron.db.run(
      `INSERT INTO chats (id, summary, provider, model, systemMessage, temperature, maxCtxMessages, maxTokens, stream, prompt, input, folderId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?)`,
      [
        $chat.id,
        $chat.summary,
        $chat.provider || null,
        $chat.model || null,
        $chat.systemMessage || null,
        $chat.temperature || null,
        $chat.maxCtxMessages || null,
        $chat.maxTokens || null,
        stream,
        prompt,
        $chat.input,
        $chat.folderId || null,
        $chat.createdAt,
      ],
    );
    if (!ok) {
      throw new Error('Write the chat into database failed');
    }
    if (beforeSetCallback) {
      await beforeSetCallback($chat);
    }
    set(
      produce((state: IChatStore) => {
        state.chat = $chat;
        state.chats = [$chat, ...state.chats];
        state.messages = [];
      }),
    );
    return $chat;
  },
  updateChat: async (chat: { id: string } & Partial<IChat>) => {
    const $chat = { id: chat.id } as IChat;
    const stats: string[] = [];
    const params: (string | number | null)[] = [];
    if (isNotBlank(chat.name)) {
      stats.push('name = ?');
      $chat.name = chat.name as string;
      params.push($chat.name);
    }
    if (isNotBlank(chat.summary)) {
      stats.push('summary = ?');
      $chat.summary = chat.summary as string;
      params.push($chat.summary);
    }
    if (isNotBlank(chat.provider)) {
      stats.push('provider = ?');
      $chat.provider = chat.provider as string;
      params.push($chat.provider);
    }
    if (isNotBlank(chat.model)) {
      stats.push('model = ?');
      $chat.model = chat.model as string;
      params.push($chat.model);
    }
    if (!isNil(chat.systemMessage)) {
      stats.push('systemMessage = ?');
      $chat.systemMessage = chat.systemMessage as string;
      params.push($chat.systemMessage);
    }
    if (isNumber(chat.maxCtxMessages) && chat.maxCtxMessages >= 0) {
      stats.push('maxCtxMessages = ?');
      $chat.maxCtxMessages = chat.maxCtxMessages;
      params.push($chat.maxCtxMessages);
    }
    if (isNumber(chat.temperature)) {
      stats.push('temperature = ?');
      $chat.temperature = chat.temperature;
      params.push($chat.temperature);
    }
    if (isNumber(chat.maxTokens) && chat.maxTokens > 0) {
      stats.push('maxTokens = ?');
      $chat.maxTokens = chat.maxTokens;
      params.push($chat.maxTokens);
    }
    if (!isNil(chat.context)) {
      stats.push('context = ?');
      chat.context = chat.context as string;
      params.push(chat.context);
    }
    if (!isNil(chat.stream)) {
      stats.push('stream = ?');
      $chat.stream = chat.stream;
      params.push($chat.stream ? 1 : 0);
    }
    if (!isUndefined(chat.input)) {
      $chat.input = chat.input as string;
      stats.push('input = ?');
      params.push($chat.input);
    }
    if (!isUndefined(chat.prompt)) {
      try {
        $chat.prompt = chat.prompt;
        stats.push('prompt = ?');
        params.push(
          chat.prompt ? (JSON.stringify(chat.prompt) as string) : null,
        );
      } catch (err: any) {
        captureException(err);
      }
    }
    if (!isUndefined(chat.folderId)) {
      stats.push('folderId = ?');
      $chat.folderId = chat.folderId;
      params.push($chat.folderId);
    }
    if ($chat.id && stats.length) {
      params.push($chat.id);
      await window.electron.db.run(
        `UPDATE chats SET ${stats.join(', ')} WHERE id = ?`,
        params,
      );
      const curChat = await get().getChat($chat.id);
      const updatedChat = { ...curChat, ...$chat } as IChat;
      set(
        produce((state: IChatStore) => {
          if (updatedChat.id === state.chat.id) {
            state.chat = updatedChat;
          }
          state.chats = state.chats.map((c: IChat) => {
            if (c.id === updatedChat.id) {
              return updatedChat;
            }
            return c;
          });
        }),
      );
      debug('Update chat ', updatedChat);
      return true;
    }
    return false;
  },
  fetchChat: async (id: string) => {
    const chat = (await window.electron.db.get(
      'SELECT id, name, summary, provider, model, systemMessage, maxTokens, temperature, context, maxCtxMessages, stream, prompt, input, folderId, createdAt FROM chats where id = ?',
      id,
    )) as IChat;
    debug('Fetch chat from DB:', chat);
    debug('DB chat provider:', chat?.provider, 'model:', chat?.model);
    return chat;
  },
  getChat: async (id: string) => {
    const { fetchChat, chats } = get();
    let chat = chats.find((c) => c.id === id);
    if (!chat) {
      chat = await fetchChat(id);
    }
    if (chat) {
      try {
        chat.prompt = chat.prompt ? JSON.parse(chat.prompt as string) : null;
      } catch (err: any) {
        captureException(err);
      }
    }
    debug('Get chat:', chat);
    set({ chat });
    return chat;
  },
  fetchChats: async (limit: number = 300, offset = 0) => {
    const rows = (await window.electron.db.all(
      'SELECT id, name, summary, folderId, provider, model, systemMessage, maxTokens, temperature, maxCtxMessages, stream, prompt, input, createdAt FROM chats ORDER BY createdAt DESC limit ? offset ?',
      [limit, offset],
    )) as IChat[];
    const chats = rows.map((chat) => {
      try {
        chat.prompt = chat.prompt ? JSON.parse(chat.prompt as string) : null;
      } catch (err: any) {
        debug('parse chat.prompt failed', err);
      }
      return chat;
    });
    set({ chats });
    return chats;
  },
  deleteChat: async (chatId?: string) => {
    const { chat, initChat } = get();
    const id = chatId || chat.id;
    try {
      if (id !== TEMP_CHAT_ID) {
        await window.electron.db.run(`DELETE FROM chats WHERE id = ?`, [id]);
        await window.electron.db.run(`DELETE FROM messages WHERE chatId = ?`, [
          id,
        ]);
        set(
          produce((state: IChatStore) => {
            state.messages = [];
            const index = state.chats.findIndex((i) => i.id === id);
            if (index > -1) {
              state.chats.splice(index, 1);
            }
          }),
        );
      }
      initChat({});
      return true;
    } catch (err: any) {
      captureException(err);
      return false;
    }
  },
  createMessage: async (message: Partial<IChatMessage>) => {
    const msg = {
      id: typeid('msg').toString(),
      ...message,
      createdAt: date2unix(new Date()),
    } as IChatMessage;
    const columns = Object.keys(msg);
    await window.electron.db.run(
      `INSERT INTO messages (${columns.join(',')})
      VALUES(${'?'.repeat(columns.length).split('').join(',')})`,
      Object.values(msg),
    );
    set((state) => ({
      messages: [...state.messages, msg],
    }));
    return msg;
  },
  appendReply: (msgId: string, reply: string, reasoning: string) => {
    set(
      produce((state: IChatStore) => {
        const message = state.messages.find((msg) => msg.id === msgId);
        if (message) {
          message.reply = message.reply ? `${message.reply}${reply}` : reply;
          message.reasoning = message.reasoning
            ? `${message.reasoning}${reasoning}`
            : reasoning;
        }
      }),
    );
  },
  updateMessage: async (message: { id: string } & Partial<IChatMessage>) => {
    const msg = { id: message.id } as IChatMessage;
    const stats: string[] = [];
    const params: (string | number)[] = [];
    if (isNotBlank(message.prompt)) {
      stats.push('prompt = ?');
      msg.prompt = message.prompt as string;
      params.push(msg.prompt);
    }
    if (!isUndefined(message.reply)) {
      stats.push('reply = ?');
      msg.reply = message.reply as string;
      params.push(msg.reply);
    }
    if (isNotBlank(message.model)) {
      stats.push('model = ?');
      msg.model = message.model as string;
      params.push(msg.model);
    }
    if (isNumber(message.temperature)) {
      stats.push('temperature = ?');
      msg.temperature = message.temperature as number;
      params.push(msg.temperature);
    }
    if (isNumber(message.inputTokens)) {
      stats.push('inputTokens = ?');
      msg.inputTokens = message.inputTokens as number;
      params.push(msg.inputTokens);
    }
    if (isNumber(message.outputTokens)) {
      stats.push('outputTokens = ?');
      msg.outputTokens = message.outputTokens as number;
      params.push(msg.outputTokens);
    }
    if (!isNil(message.memo)) {
      stats.push('memo = ?');
      msg.memo = message.memo as string;
      params.push(msg.memo);
    }
    if (!isNil(message.isActive)) {
      stats.push('isActive = ?');
      msg.isActive = message.isActive as boolean;
      params.push(msg.isActive ? 1 : 0);
    }
    if (!isBlank(message.citedFiles)) {
      stats.push('citedFiles = ?');
      msg.citedFiles = message.citedFiles as string;
      params.push(msg.citedFiles);
    }
    if (!isBlank(message.citedChunks)) {
      stats.push('citedChunks = ?');
      msg.citedChunks = message.citedChunks as string;
      params.push(msg.citedChunks);
    }
    if (!isUndefined(message.reasoning)) {
      stats.push('reasoning = ?');
      msg.reasoning = message.reasoning as string;
      params.push(msg.reasoning);
    }
    if (isString(message.structuredPrompts)) {
      stats.push('structuredPrompts = ?');
      msg.structuredPrompts = message.structuredPrompts;
      params.push(msg.structuredPrompts as string);
    }
    if (message.id && stats.length) {
      params.push(msg.id);
      await window.electron.db.run(
        `UPDATE messages SET ${stats.join(', ')} WHERE id = ?`,
        params,
      );
      set(
        produce((state: IChatStore) => {
          const index = state.messages.findIndex((m) => m.id === msg.id);
          if (index !== -1) {
            state.messages[index] = { ...state.messages[index], ...msg };
          }
        }),
      );
      debug('Update message ', JSON.stringify(msg));
      return true;
    }
    return false;
  },
  bookmarkMessage: (id: string, bookmarkId: string | null) => {
    set(
      produce((state: IChatStore) => {
        state.messages = state.messages.map((msg) => {
          if (msg.id === id) {
            msg.bookmarkId = bookmarkId;
          }
          return msg;
        });
      }),
    );
  },
  deleteMessage: async (id: string) => {
    const ok = await window.electron.db.run(
      `DELETE FROM messages WHERE id = ?`,
      [id],
    );
    if (!ok) {
      throw new Error('Delete message failed');
    }
    const messages = [...get().messages];
    if (messages && messages.length) {
      const index = messages.findIndex((msg) => msg.id === id);
      if (index > -1) {
        debug(`remove msg(${id}) from index: ${index})`);
        messages.splice(index, 1);
        set({ messages: [...messages] });
      }
    }
    return true;
  },
  fetchMessages: async ({
    chatId,
    limit = 100,
    offset = 0,
    keyword = '',
  }: {
    chatId: string;
    limit?: number;
    offset?: number;
    keyword?: string;
  }) => {
    if (chatId === TEMP_CHAT_ID) {
      set({ messages: [] });
      return [];
    }
    let sql = `SELECT messages.*, bookmarks.id bookmarkId
    FROM messages
    LEFT JOIN bookmarks ON bookmarks.msgId = messages.id
    WHERE messages.chatId = ?`;
    let params = [chatId, limit, offset];
    if (keyword && keyword.trim() !== '') {
      sql += ` AND (messages.prompt LIKE ? COLLATE NOCASE OR messages.reply LIKE ? COLLATE NOCASE)`;
      params = [
        chatId,
        `%${keyword.trim()}%`,
        `%${keyword.trim()}%`,
        limit,
        offset,
      ];
    }
    sql += `ORDER BY messages.createdAt ASC
    LIMIT ? OFFSET ?`;
    const messages = (await window.electron.db.all(
      sql,
      params,
    )) as IChatMessage[];
    set({ messages });
    return messages;
  },
  editStage: async (chatId: string, stage: Partial<IStage>) => {
    if (chatId === TEMP_CHAT_ID) {
      set(
        produce((state: IChatStore): void => {
          if (!isUndefined(stage.prompt)) {
            if (isNull(stage.prompt)) {
              state.tempStage.prompt = null;
            } else {
              state.tempStage.prompt = stage.prompt;
            }
          }
          if (!isUndefined(stage.provider)) {
            state.tempStage.provider = stage.provider || '';
          }
          if (!isUndefined(stage.model)) {
            state.tempStage.model = stage.model || '';
          }
          if (!isUndefined(stage.input)) {
            state.tempStage.input = stage.input || '';
          }
          if (!isUndefined(stage.maxCtxMessages)) {
            state.tempStage.maxCtxMessages = stage.maxCtxMessages;
          }
          if (!isUndefined(stage.maxTokens)) {
            state.tempStage.maxTokens = stage.maxTokens;
          }
          if (!isUndefined(stage.temperature)) {
            state.tempStage.temperature = stage.temperature;
          }
          if (!isUndefined(stage.systemMessage)) {
            state.tempStage.systemMessage = stage.systemMessage;
          }
          if (!isUndefined(stage.stream)) {
            state.tempStage.stream = stage.stream;
          }
        }),
      );
      get().editChat({ id: chatId, ...stage });
      window.electron.store.set('stage', get().tempStage);
    } else {
      const { updateChat } = get();
      await updateChat({ id: chatId, ...stage });
    }
  },
  deleteStage: (chatId: string) => {
    set(
      produce((state: IChatStore): void => {
        state.tempStage = defaultTempStage;
      }),
    );
    if (chatId === TEMP_CHAT_ID) {
      window.electron.store.set('stage', defaultTempStage);
    }
  },
}));

export default useChatStore;
