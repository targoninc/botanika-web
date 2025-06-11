import {Api} from "./api";
import {Configuration} from "../../models/Configuration";
import {language} from "./i8n/translation";
import {Language} from "./i8n/language";
import {ChatContext} from "../../models/chat/ChatContext";
import {terminator} from "../../models/chat/terminator";
import {updateContext} from "./updateContext.ts";
import {INITIAL_CONTEXT} from "../../models/chat/initialContext";
import {McpConfiguration} from "../../models/mcp/McpConfiguration";
import {playAudio} from "./audio/audio";
import {ChatUpdate} from "../../models/chat/ChatUpdate";
import {ShortcutConfiguration} from "../../models/shortcuts/ShortcutConfiguration";
import {defaultShortcuts} from "../../models/shortcuts/defaultShortcuts";
import {ProviderDefinition} from "../../models/llms/ProviderDefinition";
import {toast} from "./ui";
import {ToastType} from "../enums/ToastType";
import {setRootCssVar} from "./setRootCssVar";
import {Signal, signal} from "@targoninc/jess";
import {Tables} from "../../models/supabaseDefinitions.ts";
import {ApiResponse} from "./api.base.ts";
import {response} from "express";

export const activePage = signal<string>("chat");
export const configuration = signal<Configuration>({} as Configuration);
export const chatContext = signal<ChatContext>(INITIAL_CONTEXT);
export const chats = signal<ChatContext[]>([]);
export const availableModels = signal<Record<string, ProviderDefinition>>({});
export const mcpConfig = signal<McpConfiguration|null>(null);
export const currentlyPlayingAudio = signal<string>(null);
export const shortCutConfig = signal<ShortcutConfiguration>(defaultShortcuts);
export const currentText = signal<string>("");
export const currentUser = signal<Tables<"users">>(null);

export function initializeStore() {
    configuration.subscribe(c => {
        language.value = c.language as Language;
        setRootCssVar("--tint", c.tintColor ?? "#00ff00");
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
    tryLoadFromCache<McpConfiguration>("mcpConfig", mcpConfig, Api.getMcpConfig());
    tryLoadFromCache<Record<string, ProviderDefinition>>("models", availableModels, Api.getModels());
    tryLoadFromCache<Tables<"users">>("currentUser", currentUser, Api.getUser());
}

function tryLoadFromCache<T>(key: string, value: Signal<T>, apiRequest: Promise<ApiResponse<T | string>>, getUpdateData: (data: T) => T = null){
    const storeCacheKey = "storeCache_" + key;
    const cachedValue = localStorage.getItem(storeCacheKey);

    value.subscribe(newValue => {
        localStorage.setItem(storeCacheKey, JSON.stringify(newValue));
    })

    if (cachedValue) {
        try {
            value.value = JSON.parse(cachedValue) as T;
        } catch (e) {
            console.error(`Error parsing cached value for ${storeCacheKey}:`, e);
        }
    }

    if (!getUpdateData) {
        getUpdateData = (data: T) => {
            return data;
        };
    }

    apiRequest.then(response => {
        if (response.success && response.data) {
            value.value = getUpdateData(response.data as T);
        }
    });
}

function asyncSemaphore(maxCount: number){
    let currentCount = 0;
    const releaseMethods: (() => void)[] = [];

    const release = () => {
        currentCount--;
        if (releaseMethods.length > 0) {
            const nextRelease = releaseMethods.shift();
            if (nextRelease) {
                nextRelease();
            }
        }
    };

    return {
        async acquire(): Promise<() => void>  {
            if (currentCount < maxCount) {
                currentCount++;
                return release;
            }

            return await new Promise<() => void>((resolve) => {
                currentCount++;
                releaseMethods.push(() => resolve(release));
            });
        },
    };
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function loadAllChats(newChats: ChatContext[]) {
    const loadChatsSemaphore = asyncSemaphore(5);

    const chatUpdates = newChats.map(async chat => {
        const releaseSemaphore = await loadChatsSemaphore.acquire();
        try {
            const chatContext = await Api.getChat(chat.id);

            if (chatContext.success) {
                updateChats([
                    ...chats.value.map(c => {
                        if (c.id === chat.id) {
                            return chatContext.data as ChatContext;
                        }
                        return c;
                    }),
                ]);

                return chatContext.data as ChatContext;
            }

            return null;
        } finally{
            releaseSemaphore();
        }
    });

    return await Promise.allSettled(chatUpdates)
        .then(results => {
            const response: ApiResponse<ChatContext[] | string> = {
                success: true,
                status: 200,
                data: results
                    .filter(result => result.status === "fulfilled" && result.value !== null)
                    .map(result => (result as PromiseFulfilledResult<ChatContext>).value)
            };

            return response;
        })
}

export type Callback<Args extends unknown[]> = (...args: Args) => void;

export function target(e: Event) {
    return e.target as HTMLInputElement;
}

export function updateChats(newChats: ChatContext[]) {
    chats.value = newChats.sort((a, b) => b.createdAt - a.createdAt);
}

export async function processUpdate(update: ChatUpdate) {
    const newChat = updateContext(chatContext.value, update, chatContext);
    const cs = chats.value;
    if (!cs.find(c => c.id === update.chatId)) {
        updateChats([
            ...chats.value,
            newChat
        ]);
    } else {
        updateChats(chats.value.map(c => {
            if (c.id === update.chatId) {
                return updateContext(c, update);
            }
            return c;
        }));
    }

    const playableMessage = update.messages?.find(m => m.hasAudio);
    const isLast = playableMessage && update.messages.pop().id === playableMessage.id;
    if (playableMessage && isLast) {
        playAudio(playableMessage.id).then();
    }
}

export async function updateContextFromStream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }
        const decodedUpdates = new TextDecoder().decode(value).split(terminator).filter(s => s.length > 0);
        const lastUpdate = decodedUpdates.pop();
        if (!lastUpdate) {
            continue;
        }
        let update: ChatUpdate;
        try {
            update = JSON.parse(lastUpdate.trim());
        } catch (e) {
            console.log("Error parsing update: ", lastUpdate, e.toString());
            continue;
        }

        if (update.error) {
            toast(update.error, null, ToastType.negative);
            continue;
        }

        await processUpdate(update);
    }
}

export function activateChat(chat: ChatContext) {
    chatContext.value = chat;
}

export function deleteChat(chatId: string) {
    chats.value = chats.value.filter(c => c.id !== chatId);
    Api.deleteChat(chatId).then(() => {
        if (chatContext.value.id === chatId || !chatContext.value.id) {
            chatContext.value = INITIAL_CONTEXT;
        }
    });
}