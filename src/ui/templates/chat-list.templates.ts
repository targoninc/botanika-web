import {compute, create, InputType, Signal, signal, when} from "@targoninc/jess";
import {GenericTemplates} from "./generic.templates.ts";
import {activePage, chatContext, chats, currentChatId, deleteChat, eventStore, search} from "../classes/state/store.ts";
import {searchList} from "../classes/search.ts";
import {ChatTemplates} from "./chat.templates.ts";
import {button, icon, input} from "@targoninc/jess-components";
import {ChatContext} from "../../models/chat/ChatContext.ts";
import { BotanikaClientEvent } from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import { SharedChangedEventData } from "../../models/websocket/clientEvents/sharedChangedEventData.ts";
import { BotanikaClientEventType } from "../../models/websocket/clientEvents/botanikaClientEventType.ts";
import {createModal, toast} from "../classes/ui.ts";
import {ChatNameChangedEventData} from "../../models/websocket/clientEvents/chatNameChangedEventData.ts";
import {realtime} from "../index.ts";
import {ChatUpdate} from "../../models/chat/ChatUpdate.ts";

export class ChatListTemplates {
    static chatList(context: string, shown: Signal<boolean>) {
        const newDisabled = compute(c => Object.keys(c).length === 0, chatContext);
        const userPopupVisible = signal(false);
        const filteredChats = compute((c, s) => searchList(["history", "name"], c, s), chats, search);
        const cachedWidth = localStorage.getItem(`divider-width-.chat-list.sidebar`);
        let initialWidth = "max(30%, 200px)";
        if (cachedWidth) {
            initialWidth = cachedWidth + "px";
        }

        return create("div")
            .classes("flex-v", "container", "small-gap", "chat-list", context)
            .styles("width", context === "sidebar" ? initialWidth : "100%")
            .children(
                when(context === "burger-menu", ChatListTemplates.burgerButton(shown)),
                create("div")
                    .classes("flex", "space-between", "align-children")
                    .children(
                        button({
                            disabled: newDisabled,
                            icon: {
                                icon: "create"
                            },
                            text: "New chat",
                            classes: ["flex", "align-center", "positive"],
                            onclick: () => {
                                currentChatId.value = null;
                            }
                        }),
                        create("div")
                            .classes("flex", "relative", "align-children")
                            .children(
                                GenericTemplates.buttonWithIcon("settings", "Settings", async () => {
                                    activePage.value = "settings";
                                }),
                                GenericTemplates.userIcon(userPopupVisible),
                                when(userPopupVisible, GenericTemplates.userPopup()),
                            ).build(),
                    ).build(),
                create("div")
                    .classes("relative")
                    .children(
                        input({
                            type: InputType.text,
                            placeholder: "Search chats...",
                            name: "chatsSearch",
                            value: search,
                            classes: ["full-width"],
                            onchange: value => {
                                search.value = value;
                            }
                        }),
                        icon({
                            icon: "close",
                            classes: ["search-clear", "clickable"],
                            onclick: () => search.value = ""
                        })
                    ).build(),
                compute(c => ChatListTemplates.chatListItems(c, shown), filteredChats),
            ).build();
    }

    static chatListItems(chat: ChatContext[], menuShown: Signal<boolean>) {
        return create("div")
            .classes("flex-v", "flex-grow", "small-gap", "chat-list-items")
            .children(
                when(chat.length === 0, create("span")
                    .text("No chats yet")
                    .build()
                ),
                ...chat.map(chatId => ChatListTemplates.chatListItem(chatId, menuShown))
            ).build();
    }

    static chatListItem(chat: ChatContext, menuShown: Signal<boolean>) {
        const active = compute(c => c && c === chat.id, currentChatId);
        const activeClass = compute((c): string => c ? "active" : "_", active);
        const editing = signal(false);
        const chatName = signal(chat.name);
        const shared = signal(chat.shared);
        shared.subscribe((s, changed) => {
            if (!changed) {
                return;
            }
            realtime.send(<BotanikaClientEvent<SharedChangedEventData>>{
                type: BotanikaClientEventType.sharedChanged,
                data: {
                    chatId: chat.id,
                    newValue: s
                }
            });
            if (s) {
                const link = window.location.origin + `/chat?chatId=${chat.id}&shared=true`;
                navigator.clipboard.writeText(link);
                toast("Link copied to clipboard");
            } else {
                toast("Chat made private");
            }
        });

        eventStore.subscribe((event) => {
            if (event.type !== "chatUpdate") {
                return;
            }

            const data = event.data as ChatUpdate;
            if (data.chatId === currentChatId.value && data.name) {
                chatName.value = data.name;
            }
            if (data.chatId === currentChatId.value && data.shared !== undefined) {
                shared.value = data.shared;
            }
        });

        return create("div")
            .classes("flex-v", "small-gap", "chat-list-item", "relative", activeClass)
            .onclick(() => {
                if (!editing.value) {
                    currentChatId.value = chat.id;
                    menuShown.value = false;
                }
            })
            .children(
                create("div")
                    .classes("flex", "align-center", "no-wrap", "space-between")
                    .children(
                        when(editing, create("span")
                            .classes("text-small")
                            .text(chatName)
                            .build(), true),
                        when(editing, input({
                            type: InputType.text,
                            placeholder: "Chat name",
                            value: chatName,
                            name: "chatName",
                            onchange: value => chatName.value = value
                        })),
                        create("div")
                            .classes("flex", "align-children", "no-wrap", "chat-actions")
                            .children(
                                when(compute(cn => cn !== chat.name, chatName), GenericTemplates.buttonWithIcon("check", "", () => {
                                    realtime.send(<BotanikaClientEvent<ChatNameChangedEventData>>{
                                        type: BotanikaClientEventType.chatNameChanged,
                                        data: {
                                            chatId: chat.id,
                                            name: chatName.value
                                        }
                                    });
                                    editing.value = false;
                                }, ["no-wrap"])),
                                GenericTemplates.iconButton(compute(e => e ? "close" : "edit", editing), compute(e => e ? "Cancel editing" : "Edit chat name", editing), () => editing.value = !editing.value),
                                GenericTemplates.iconButton(compute(e => e ? "public" : "lock", shared), compute(e => e ? "Make private" : "Make public", shared), () => shared.value = !shared.value),
                                GenericTemplates.iconButton("delete", "Edit chat name", (e) => {
                                    e.stopPropagation();
                                    createModal(GenericTemplates.confirmModalWithContent("Delete chat", create("div")
                                        .classes("flex-v")
                                        .children(
                                            create("p")
                                                .text(`Are you sure you want to delete this chat?`)
                                                .build(),
                                        ).build(), "Yes", "No", () => {
                                        deleteChat(chat.id);
                                    }));
                                }),
                            ).build()
                    ).build(),
                ChatTemplates.date(chat.createdAt),
            ).build();
    }

    static burgerButton(shown: Signal<boolean>) {
        return create("div")
            .classes("burger-button", compute(s => s ? "inline" : "absolute", shown))
            .children(
                GenericTemplates.iconButton(compute(s => s ? "close" : "menu", shown), "Close chat list", () => shown.value = !shown.value),
            ).build();
    }
}