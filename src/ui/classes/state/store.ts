import {Api} from "./api";
import {compute, signal} from "@targoninc/jess";
import {ApiResponse} from "./api.base.ts";
import {tryLoadFromCache} from "./tryLoadFromCache.ts";
import {Configuration} from "../../../models/Configuration";
import {ChatContext} from "../../../models/chat/ChatContext.ts";
import {INITIAL_CONTEXT} from "../../../models/chat/initialContext.ts";
import {ProviderDefinition} from "../../../models/llms/ProviderDefinition.ts";
import {ShortcutConfiguration} from "../../../models/shortcuts/ShortcutConfiguration.ts";
import {defaultShortcuts} from "../../../models/shortcuts/defaultShortcuts.ts";
import {Language} from "../i8n/language.ts";
import {language} from "../i8n/translation.ts";
import {setRootCssVar} from "../setRootCssVar.ts";
import {asyncSemaphore} from "../asyncSemaphore.ts";
import {UserinfoResponse} from "openid-client";
import {McpServerConfig} from "../../../models/mcp/McpServerConfig.ts";
import {focusChatInput} from "../../index.ts";
import {getPathname, getUrlParameter, updateUrlParameter, updateUrlPathname} from "./urlHelpers.ts";
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
export const mcpConfig = signal<McpServerConfig[] | null>(null);
export const currentlyPlayingAudio = signal<string|null>(null);
export const shortCutConfig = signal<ShortcutConfiguration>(defaultShortcuts);
export const currentText = signal<string>("");
export const currentUser = signal<User & UserinfoResponse | null>(null);
export const connected = signal(false);
export const search = signal("");

const getNewestChatDate = (chts: ChatContext[]) => {
    const updatedDates = chts.filter(c => !!c.updatedAt).map(c => c.updatedAt);
    return updatedDates.length > 0 ? Math.max(...updatedDates) : null;
}

export function initializeStore() {
    configuration.subscribe(c => {
        language.value = c.language as Language;
        setRootCssVar("--tint", c.tintColor ?? "#00064f");
    });

    currentChatId.subscribe(c => {
        updateUrlParameter("chatId", c);
        focusChatInput();
    });

    chatContext.subscribe(c => {
        const url = new URL(window.location.href);
        if (c?.shared && c.shared.toString() !== url.searchParams.get("shared")) {
            updateUrlParameter("shared", c.shared ? "true" : null);
        }
        focusChatInput();
    });

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
        updateUrlPathname(c);
    });

    shortCutConfig.subscribe(async (sc, changed) => {
        if (!changed) {
            return;
        }
        await Api.setShortcutConfig(sc);
    });

    tryLoadFromCache<Configuration>("config", configuration, () => Api.getConfig());
    tryLoadFromCache<ChatContext[]>("chats", chats, (cachedChats) => Api.getNewestChats((cachedChats && cachedChats.length > 0) ? new Date(getNewestChatDate(cachedChats)) : undefined)
        .then(async result => {
            if (result.success && result.data) {
                return await loadAllChats(result.data as ChatContext[]);
            }

            const response: ApiResponse<ChatContext[] | string> = {
                success: false,
                data: "Failed to load chats",
                status: 500
            };

            return response;
        }), () => {
        Api.getDeletedChats(chats.value.map(c => c.id)).then(res => {
            if (res.success && res.data) {
                chats.value = chats.value.filter(c => !res.data.includes(c.id));
                if (res.data.includes(currentChatId.value)) {
                    currentChatId.value = null;
                }
            }
        });
        return chats.value;
    });
    tryLoadFromCache<ShortcutConfiguration>("shortcuts", shortCutConfig, () => Api.getShortcutConfig());
    tryLoadFromCache<McpServerConfig[]>("mcpConfig", mcpConfig, () => Api.getMcpConfig());
    tryLoadFromCache<Record<string, ProviderDefinition>>("models", availableModels, () => Api.getModels());
    tryLoadFromCache<User & UserinfoResponse>("currentUser", currentUser, () => Api.getUser());
}

export async function loadAllChats(newChats: ChatContext[]) {
    const loadChatsSemaphore = asyncSemaphore(5);

    const loadSingleChat = async (chat: ChatContext) => {
        const releaseSemaphore = await loadChatsSemaphore.acquire();
        try {
            const response = await Api.getChat(chat.id);

            if (response.success) {
                const chatData = response.data as ChatContext;
                updateChats([
                    ...chats.value.filter(c => c.id !== chat.id),
                    chatData
                ]);
                return chatData;
            }
            return null;
        } finally {
            releaseSemaphore();
        }
    };

    await Promise.allSettled(newChats.map(loadSingleChat));

    return {
        success: true,
        data: [],
        status: 200
    };
}

export type Callback<Args extends unknown[]> = (...args: Args) => void;

export function target(e: Event) {
    return e.target as HTMLInputElement;
}

export function updateChats(newChats: ChatContext[]) {
    chats.value = newChats.sort((a, b) => b.createdAt - a.createdAt);
}

export const activateNextUpdate = signal(false);

export function deleteChat(chatId: string) {
    updateChats(chats.value.filter(c => c.id !== chatId));
    Api.deleteChat(chatId).then(() => {
        if (currentChatId.value === chatId) {
            currentChatId.value = null;
        }
    });
}
