import {Api} from "./api";
import {compute, signal} from "@targoninc/jess";
import {ApiResponse} from "./api.base.ts";
import {tryLoadFromCache} from "./tryLoadFromCache.ts";
import { Configuration } from "../../../models/Configuration";
import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {INITIAL_CONTEXT} from "../../../models/chat/initialContext.ts";
import {ProviderDefinition} from "../../../models/llms/ProviderDefinition.ts";
import {ShortcutConfiguration} from "../../../models/shortcuts/ShortcutConfiguration.ts";
import {defaultShortcuts} from "../../../models/shortcuts/defaultShortcuts.ts";
import {Language} from "../i8n/language.ts";
import { language } from "../i8n/translation.ts";
import {setRootCssVar} from "../setRootCssVar.ts";
import { asyncSemaphore } from "../asyncSemaphore.ts";
import {ChatUpdate} from "../../../models/chat/ChatUpdate.ts";
import {updateContext} from "../updateContext.ts";
import {playAudio} from "../audio/audio.ts";
import {UserinfoResponse} from "openid-client";
import {McpServerConfig} from "../../../models/mcp/McpServerConfig.ts";
import {focusChatInput} from "../../index.ts";
import {getPathname, getUrlParameter} from "./urlHelpers.ts";
import {User} from "@prisma/client";

export const activePage = signal<string>(getPathname() ?? "chat");
export const configuration = signal<Configuration>({} as Configuration);

export const currentChatId = signal<string | null>(getUrlParameter("chatId", null));
export const chats = signal<ChatContext[]>([]);
export const chatContext = compute((id, chatsList) => {
    if (!id) return INITIAL_CONTEXT;
    const chat = chatsList.find(c => c.id === id);
    return chat || INITIAL_CONTEXT;
}, currentChatId, chats);
export const availableModels = signal<Record<string, ProviderDefinition>>({});
export const mcpConfig = signal<McpServerConfig[]|null>(null);
export const currentlyPlayingAudio = signal<string>(null);
export const shortCutConfig = signal<ShortcutConfiguration>(defaultShortcuts);
export const currentText = signal<string>("");
export const currentUser = signal<User & UserinfoResponse>(null);
export const connected = signal(false);

export function initializeStore() {
    configuration.subscribe(c => {
        language.value = c.language as Language;
        setRootCssVar("--tint", c.tintColor ?? "#5367ac");
    });

    currentChatId.subscribe(c => {
        const url = new URL(window.location.href);
        url.searchParams.set("chatId", c);
        history.pushState({}, "", url);
        focusChatInput();
    });

    chatContext.subscribe(c => {
        const url = new URL(window.location.href);
        if (c.shared) {
            url.searchParams.set("shared", "true");
        } else {
            url.searchParams.delete("shared");
        }
        history.pushState({}, "", url);
        focusChatInput();
    })

    const chatId = getUrlParameter("chatId", null);
    const shared = getUrlParameter("shared", null);
    if (chatId && shared === "true") {
        Api.getChat(chatId, true).then(c => {
            if (c.success) {
                chatContext.value = c.data as ChatContext;
            }
        });
    }

    activePage.subscribe(c => {
        const url = new URL(window.location.href);
        url.pathname = c;
        history.pushState({}, "", url);
    });

    shortCutConfig.subscribe(async (sc, changed) => {
        if (!changed) {
            return;
        }
        await Api.setShortcutConfig(sc);
    });

    tryLoadFromCache<Configuration>("config", configuration, Api.getConfig());
    tryLoadFromCache<ChatContext[]>("chats", chats, Api.getNewestChats().then(async result => {
        if (result.success && result.data) {
            return await loadAllChats(result.data as ChatContext[]);
        }

        const response: ApiResponse<ChatContext[] | string> = {
            success: false,
            data: "Failed to load chats",
            status: 500
        };

        return response;
    }), data => {
        // TODO: Once getNewestChats actually return only the newest chats we need to combine the old chats and the new ones.
        return data;
    });
    tryLoadFromCache<ShortcutConfiguration>("shortcuts", shortCutConfig, Api.getShortcutConfig());
    tryLoadFromCache<McpServerConfig[]>("mcpConfig", mcpConfig, Api.getMcpConfig());
    tryLoadFromCache<Record<string, ProviderDefinition>>("models", availableModels, Api.getModels());
    tryLoadFromCache<User & UserinfoResponse>("currentUser", currentUser, Api.getUser());
}

export async function loadAllChats(newChats: ChatContext[]) {
    const loadChatsSemaphore = asyncSemaphore(5);

    const chatUpdates = newChats.map(async chat => {
        const releaseSemaphore = await loadChatsSemaphore.acquire();
        try {
            const chatContext = await Api.getChat(chat.id);

            if (chatContext.success) {
                updateChats([
                    ...chats.value.filter(c => c.id !== chat.id),
                    chatContext.data as ChatContext
                ]);

                return chatContext.data as ChatContext;
            }

            return null;
        } finally{
            releaseSemaphore();
        }
    });

    await Promise.allSettled(chatUpdates);

    return {
        success: true,
        data: null,
        status: 200
    }
}

export type Callback<Args extends unknown[]> = (...args: Args) => void;

export function target(e: Event) {
    return e.target as HTMLInputElement;
}

export function updateChats(newChats: ChatContext[]) {
    chats.value = newChats.sort((a, b) => b.createdAt - a.createdAt);
}

export const activateNextUpdate = signal(false);

export async function processUpdate(update: ChatUpdate) {
    const cs = chats.value;
    if (!cs.find(c => c.id === update.chatId)) {
        const newChat = updateContext(INITIAL_CONTEXT, update);
        updateChats([
            ...chats.value,
            newChat
        ]);

        if (activateNextUpdate.value && update.messages && update.messages.length === 1 && update.messages[0].type === "user") {
            currentChatId.value = update.chatId;
        }
    } else {
        updateChats(chats.value.map(c => {
            if (c.id === update.chatId) {
                return updateContext(c, update);
            }
            return c;
        }));
    }

    const playableMessage = update.messages?.find(m => m.hasAudio);
    const isLast = playableMessage && update.messages.length > 0 && update.messages[update.messages.length - 1].id === playableMessage.id;
    if (playableMessage && isLast) {
        playAudio(playableMessage.id).then();
    }
}

export function deleteChat(chatId: string) {
    updateChats(chats.value.filter(c => c.id !== chatId));
    Api.deleteChat(chatId).then(() => {
        if (currentChatId.value === chatId) {
            currentChatId.value = null;
        }
    });
}
