import {
    activateNextUpdate,
    activePage,
    availableModels,
    chatContext,
    chats,
    configuration,
    connected,
    currentChatId,
    currentlyPlayingAudio,
    currentText,
    deleteChat,
    shortCutConfig,
    target,
    updateChats,
} from "../classes/state/store";
import {GenericTemplates} from "./generic.templates";
import {ChatContext} from "../../models/chat/ChatContext";
import {ChatMessage} from "../../models/chat/ChatMessage";
import {attachCodeCopyButtons, createModal, toast} from "../classes/ui";
import {marked} from "marked";
import DOMPurify from 'dompurify';
import {ResourceReference} from "../../models/chat/ResourceReference";
import {ModelDefinition} from "../../models/llms/ModelDefinition";
import {LlmProvider} from "../../models/llms/llmProvider";
import {playAudio, stopAudio} from "../classes/audio/audio";
import {ProviderDefinition} from "../../models/llms/ProviderDefinition";
import {AudioTemplates} from "./audio.templates";
import {compute, create, InputType, nullElement, Signal, signal, signalMap, when} from "@targoninc/jess";
import {button, input} from "@targoninc/jess-components";
import {featureOptions} from "../../models/features/featureOptions.ts";
import {SettingConfiguration} from "../../models/uiExtensions/SettingConfiguration.ts";
import {focusChatInput, realtime} from "../index.ts";
import {BotanikaClientEventType} from "../../models/websocket/clientEvents/botanikaClientEventType.ts";
import {NewMessageEventData} from "../../models/websocket/clientEvents/newMessageEventData.ts";
import {MessageFile} from "../../models/chat/MessageFile.ts";
import {attachFiles, handleDroppedFiles, pasteFile} from "../classes/attachFiles.ts";
import {Api} from "../classes/state/api.ts";
import hljs from "highlight.js";
import {FileTemplates} from "./file.templates.ts";
import {BotanikaClientEvent} from "../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {ChatNameChangedEventData} from "../../models/websocket/clientEvents/chatNameChangedEventData.ts";
import {getHost} from "../classes/state/urlHelpers.ts";
import {providerFeatureMap} from "../enums/providerFeatureMap.ts";

function parseMarkdown(text: string) {
    const rawMdParsed = marked.parse(text, {
        async: false
    });
    return DOMPurify.sanitize(rawMdParsed);
}

export class ChatTemplates {
    static chat() {
        const menuShown = signal(false);

        return create("div")
            .classes("flex", "no-wrap", "relative", "restrict-to-parent")
            .children(
                ChatTemplates.chatList("sidebar", menuShown),
                ChatTemplates.chatBox(menuShown),
                when(menuShown, ChatTemplates.chatList("burger-menu", menuShown))
            ).build();
    }

    static chatBox(shown: Signal<boolean>) {
        return create("div")
            .classes("flex-v", "container", "relative", "no-gap", "no-padding", "chat-box")
            .children(
                ChatTemplates.burgerButton(shown),
                ChatTemplates.botName(),
                ChatTemplates.chatHistory(),
                ChatTemplates.chatInput(),
            ).build();
    }

    static botName() {
        return create("div")
            .classes("flex", "align-center", "bot-name", "align-children")
            .children(
                create("div")
                    .classes("relative")
                    .children(
                        GenericTemplates.icon("person", ["bot-icon"]),
                        GenericTemplates.statusIndicator(connected),
                    ).build(),
                create("span")
                    .classes("bot-name-text")
                    .text(compute(c => c.botname ?? "Anika", configuration))
                    .build(),
                create("span")
                    .text(compute(c => c.name ?? "New chat", chatContext))
                    .build(),
            ).build();
    }

    static chatHistory() {
        const history = compute(c => c?.history ?? [], chatContext);
        const dedupHistory = compute(h => {
            h = h.sort((a, b) => a.time - b.time);
            return h.reduce((prev, cur) => {
                if (!prev.some(h => h.id === cur.id)) {
                    prev.push(cur);
                }
                return prev;
            }, []);
        }, history);
        dedupHistory.subscribe(() => {
            setTimeout(() => {
                hljs.highlightAll();
                attachCodeCopyButtons();
            });
        });

        return create("div")
            .classes("flex-v", "flex-grow", "chat-history")
            .styles("overflow-y", "auto")
            .children(
                signalMap(dedupHistory, create("div").classes("restrict-width-small", "message-history", "flex-v"), (m, i) => ChatTemplates.chatMessage(m, i === dedupHistory.value.length - 1)),
            ).build();
    }

    private static chatMessage(message: ChatMessage, isLast: boolean) {
        if (message.text.trim().length === 0) {
            return nullElement();
        }

        return create("div")
            .classes("flex-v", "small-gap", "chat-message", message.type)
            .children(
                create("div")
                    .classes("flex", "message-time")
                    .children(
                        ChatTemplates.date(message.time),
                    ).build(),
                create("div")
                    .classes("flex-v", "card", "message-content")
                    .children(
                        ChatTemplates.toolCalls(message),
                        ChatTemplates.reasoning(message),
                        create("div")
                            .html(parseMarkdown(message.text))
                            .build(),
                    ).build(),
                message.files && message.files.length > 0 ? ChatTemplates.messageFiles(message) : null,
                when(message.finished, ChatTemplates.messageActions(message)),
                when(isLast, GenericTemplates.spacer()),
            ).build();
    }

    private static messageFiles(message: ChatMessage) {
        return create("div")
            .classes("flex", "align-center", "message-content", "no-wrap")
            .children(
                ...message.files.map(f => FileTemplates.fileDisplayContent(f).content),
            ).build();
    }

    static messageActions(message: ChatMessage) {
        const audioDisabled = compute(a => !!a && a !== message.id, currentlyPlayingAudio);

        return create("div")
            .classes("flex", "align-center", "message-actions")
            .children(
                message.hasAudio ? button({
                    disabled: audioDisabled,
                    icon: { icon: compute(a => a === message.id ? "stop_circle" : "volume_up", currentlyPlayingAudio) },
                    onclick: () => {
                        if (currentlyPlayingAudio.value === message.id) {
                            stopAudio();
                        } else {
                            playAudio(message.id).then();
                        }
                    },
                    classes: ["flex", "align-center", "icon-button"]
                }) : null,
                GenericTemplates.iconButton("content_copy", "Copy", async (e) => {
                    e.stopPropagation();
                    await navigator.clipboard.writeText(message.text);
                    toast("Copied to clipboard");
                }),
                when(message.type === "assistant", GenericTemplates.iconButton("alt_route", "Branch within chat", async (e) => {
                    e.stopPropagation();
                    createModal(GenericTemplates.confirmModal("Branch within chat", `This will delete all messages after the selected one and can not be reversed. Are you sure?`, "Yes", "No", async () => {
                        const r = await Api.deleteAfterMessage(chatContext.value.id, message.id);
                        if (r.success) {
                            updateChats(chats.value.map(c => {
                                if (c.id === chatContext.value.id) {
                                    const updatedChat = structuredClone(c);
                                    updatedChat.history = updatedChat.history.filter(m => m.time <= message.time);
                                    return updatedChat;
                                }
                                return c;
                            }));
                        }
                    }));
                })),
                when(message.type === "assistant", GenericTemplates.iconButton("graph_1", "Branch to new chat", async (e) => {
                    e.stopPropagation();
                    const r = await Api.branchFromMessage(chatContext.value.id, message.id);
                    if (r.success) {
                        const newContext = r.data as ChatContext;
                        updateChats([
                            ...chats.value,
                            newContext
                        ]);
                        currentChatId.value = newContext.id;
                    }
                })),
                when(message.type === "assistant", create("span")
                    .classes("text-small")
                    .text(`Generated by ${message.provider}/${message.model}`)
                    .build())
            ).build();
    }

    private static date(time: number) {
        return create("span")
            .classes("time")
            .text(new Date(time).toLocaleString("default", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
            }))
            .build();
    }

    static chatInput() {
        const input = currentText;
        const chatId = compute(c => c?.id, chatContext);
        const provider = compute(c => c.provider, configuration);
        const modelConfigured = compute(c => !!c.model, configuration);
        const model = compute((c, conf) => conf ? c.model : "No model selected", configuration, modelConfigured);
        const files = signal<MessageFile[]>([]);
        const send = () => {
            try {
                activateNextUpdate.value = true;
                realtime.send({
                    type: BotanikaClientEventType.message,
                    data: <NewMessageEventData>{
                        chatId: chatId.value,
                        provider: provider.value,
                        model: model.value,
                        message: input.value,
                        files: files.value,
                    }
                });
            } catch (e) {
                toast(e.toString());
            }
            input.value = "";
            files.value = [];
        }
        const focusInput = () => {
            document.getElementById("chat-input-field")?.focus();
        }
        const updateInputHeight = () => {
            const field = document.getElementById("chat-input-field");
            if (!field) {
                return;
            }
            field.style.height = "auto";
            field.style.height = Math.min(field.scrollHeight, 300) + "px";
        }
        input.subscribe(() => {
            updateInputHeight();
        });
        const voiceConfigured = compute(c => c && !!c.transcriptionModel, configuration);
        const flyoutVisible = signal(false);
        const isDraggingOver = signal(false);
        const hasText = compute(i => i.length > 0, input);
        const sendButtonClass = compute((h): string => h ? "has-text" : "_", hasText);
        const disabledClass = compute((h): string => !h ? "disabled" : "_", hasText);
        const noHistory = compute(c => (c?.history?.length ?? 0) === 0, chatContext);
        const noHistoryClass = compute((c): string => c?.history?.length > 0 ? "_" : "no-history", chatContext);

        return create("div")
            .classes("chat-input", noHistoryClass)
            .children(
                create("div")
                    .classes("dropzone", "relative", "flex-v", "small-gap")
                    .classes(compute(d => d ? "drag-over" : "_", isDraggingOver))
                    .ondragover((e: DragEvent) => {
                        e.preventDefault();
                        isDraggingOver.value = true;
                    })
                    .ondragleave(() => {
                        isDraggingOver.value = false;
                    })
                    .ondragend(() => {
                        isDraggingOver.value = false;
                    })
                    .ondrop((e: DragEvent) => {
                        isDraggingOver.value = false;
                        handleDroppedFiles(e, files);
                    })
                    .onclick((e) => {
                        const preventIn = ["BUTTON", "INPUT", "SELECT"];
                        if (!preventIn.includes(target(e).tagName) && !target(e).classList.contains("clickable")) {
                            console.log("focusing chat input")
                            focusChatInput();
                        }
                    })
                    .children(
                        create("div")
                            .classes("flex", "space-between")
                            .onclick(focusInput)
                            .children(
                                create("div")
                                    .classes("flex-v", "flex-grow")
                                    .children(
                                        when(noHistory, create("span")
                                            .classes("onboarding-text")
                                            .text("What's on your mind?")
                                            .build()),
                                        when(compute(f => f.length > 0, files), FileTemplates.filesDisplay(files)),
                                        ChatTemplates.actualChatInput(input, modelConfigured, send, files),
                                    ).build(),
                            ).build(),
                        create("div")
                            .classes("flex", "align-center", "space-between")
                            .children(
                                create("div")
                                    .classes("flex", "align-children")
                                    .children(
                                        create("div")
                                            .classes("relative")
                                            .children(
                                                GenericTemplates.buttonWithIcon("settings", model, () => {
                                                    flyoutVisible.value = !flyoutVisible.value;
                                                }),
                                                when(flyoutVisible, ChatTemplates.settingsFlyout(modelConfigured, flyoutVisible)),
                                            ).build(),
                                        GenericTemplates.buttonWithIcon("attach_file", "Attach files", () => attachFiles(files), ["onlyIconOnSmall"]),
                                    ).build(),
                                create("div")
                                    .classes("flex", "align-center")
                                    .children(
                                        when(voiceConfigured, AudioTemplates.voiceButton()),
                                        GenericTemplates.verticalButtonWithIcon("arrow_upward", "", send, ["send-button", sendButtonClass, disabledClass]),
                                    ).build(),
                            ).build(),
                    ).build()
            ).build();
    }

    static settingsFlyout(configured: Signal<boolean>, flyoutVisible: Signal<boolean>) {
        return create("div")
            .classes("flex-v", "flyout", "no-padding", "above", "right")
            .children(
                ChatTemplates.llmSelector(configured, flyoutVisible),
            ).build();
    }

    private static actualChatInput(input: Signal<string>, configured: Signal<boolean>, send: () => void, files: Signal<MessageFile[]>) {
        const disabledClass = compute((c): string => c ? "_" : "disabled", configured);

        return create("textarea")
            .attributes("rows", "1")
            .id("chat-input-field")
            .classes("flex-grow", "chat-input-field", "full-width", disabledClass)
            .styles("resize", "none")
            .placeholder(compute((c, conf) => conf ? `[Ctrl] + [${c.focusInput}] to focus` : "Configure a provider and model before you can chat", shortCutConfig, configured))
            .value(input)
            .oninput((e: any) => {
                input.value = target(e).value;
            })
            .onkeydown((e: any) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                }
            })
            .onpaste((e: ClipboardEvent) => pasteFile(e, files))
            .build();
    }

    private static llmSelector(configured: Signal<boolean>, flyoutVisible: Signal<boolean>) {
        const availableProviders = compute(c => Object.keys(LlmProvider).filter(p => {
            const feat = providerFeatureMap[p];
            if (!c.featureOptions || !c.featureOptions[feat]) {
                return false;
            }
            return featureOptions[feat].every((o: SettingConfiguration) => !!c.featureOptions[feat][o.key]);
        }), configuration);
        const filteredModels = compute((a, p) => {
            const out = {};
            for (const provider in a) {
                if (p.includes(provider)) {
                    out[provider] = a[provider];
                }
            }
            return out as Record<string, ProviderDefinition>;
        }, availableModels, availableProviders);
        const setProvider = async (p: LlmProvider) => {
            if (p === configuration.value.provider) {
                return;
            }
            configuration.value = {
                ...configuration.value,
                provider: p
            };
            await Api.setConfigKey("provider", p);
        };
        const provider = compute((c, p) => {
            const val = c.provider ?? "groq";
            const toUse = p.includes(val) ? val : p[0];
            if (toUse !== c.provider && toUse) {
                setProvider(toUse as LlmProvider).then();
            }
            return toUse;
        }, configuration, availableProviders);
        const anyProvider = compute(ap => ap.length > 0, availableProviders);
        anyProvider.subscribe((a) => configured.value = a);
        configured.value = anyProvider.value;
        const currentProvider = compute(c => c.provider, configuration);
        const currentModel = compute(c => c.model, configuration);

        return create("div")
            .classes("flex-v")
            .children(
                when(anyProvider, create("div")
                    .classes("flex", "no-gap", "no-wrap", "full-width")
                    .children(
                        compute(p => ChatTemplates.selectorPane(p.map(provider => ({
                            id: provider,
                            displayName: provider
                        })), currentProvider, setProvider), availableProviders),
                        compute((p, a) => {
                            if (!a[p] || Object.keys(a).length === 0) {
                                return nullElement();
                            }

                            return ChatTemplates.selectorPane(a[p].models ?? [], currentModel, async (newModel: string) => {
                                configuration.value = {
                                    ...configuration.value,
                                    model: newModel
                                };
                                await Api.setConfigKey("model", newModel);
                                flyoutVisible.value = false;
                            });
                        }, provider, filteredModels),
                    ).build()),
                when(anyProvider, GenericTemplates.warning("No provider configured, go to settings"), true),
            ).build();
    }

    private static selectorPane(p: { id: string, displayName: string }[], selected: Signal<string>, setValue: Function) {
        return create("div")
            .classes("flex-v", "no-gap", "selector-pane")
            .children(
                ...p.map(item => {
                    return create("div")
                        .classes("selector-row", compute((s): string => s === item.id ? "selected" : "_", selected))
                        .onclick(() => setValue(item.id))
                        .text(item.displayName);
                })
            ).build();
    }

    private static chatList(context: string, shown: Signal<boolean>) {
        const newDisabled = compute(c => Object.keys(c).length === 0, chatContext);
        const userPopupVisible = signal(false);

        return create("div")
            .classes("flex-v", "container", "chat-list", context)
            .children(
                when(context === "burger-menu", ChatTemplates.burgerButton(shown)),
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
                compute(c => ChatTemplates.chatListItems(c, shown), chats),
            ).build();
    }

    static chatListItems(chat: ChatContext[], menuShown: Signal<boolean>) {
        return create("div")
            .classes("flex-v", "flex-grow", "chat-list-items")
            .children(
                when(chat.length === 0, create("span")
                    .text("No chats yet")
                    .build()
                ),
                ...chat.map(chatId => ChatTemplates.chatListItem(chatId, menuShown))
            ).build();
    }

    static chatListItem(chat: ChatContext, menuShown: Signal<boolean>) {
        const active = compute(c => c && c.id === chat.id, chatContext);
        const activeClass = compute((c): string => c ? "active" : "_", active);
        const editing = signal(false);
        const chatName = signal(chat.name);

        return create("div")
            .classes("flex-v", "small-gap", "chat-list-item", "relative", activeClass)
            .onclick(() => {
                currentChatId.value = chat.id;
                menuShown.value = false;
            })
            .children(
                create("div")
                    .classes("flex", "align-center", "no-wrap", "space-between")
                    .children(
                        when(editing, create("span")
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
                                when(editing, GenericTemplates.iconButton("edit", "Edit chat name", () => editing.value = true), true),
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

    private static reference(r: ResourceReference) {
        return create("div")
            .classes("flex-v", "no-gap", "relative", "reference", r.link ? "clickable" : "_")
            .onmousedown((e) => {
                if (r.link && e.button !== 2) {
                    e.preventDefault();
                    window.open(r.link, "_blank");
                }
            })
            .children(
                create("div")
                    .classes("flex", "align-center", "no-wrap")
                    .children(
                        (r.link && !r.link.startsWith("file://")) ? create("a")
                                .href(r.link)
                                .target("_blank")
                                .title(r.link)
                                .classes("flex", "align-children")
                                .children(
                                    GenericTemplates.icon("link"),
                                    create("span")
                                        .text(r.name)
                                ).build()
                            : create("span")
                                .classes("text-small")
                                .text(r.name)
                                .build(),
                    ).build(),
                r.link ? create("span").classes("link-host").text(getHost(r.link)).build() : null,
                r.snippet ? create("div")
                        .classes("flex", "no-wrap", "small-gap", "reference-preview")
                        .children(
                            r.imageUrl ? create("img")
                                    .classes("thumbnail")
                                    .src(r.imageUrl)
                                    .alt(r.name)
                                    .build()
                                : null,
                            create("span")
                                .classes("snippet")
                                .text(r.snippet)
                                .build(),
                        ).build()
                    : null,
            ).build();
    }

    private static toolCalls(message: ChatMessage) {
        const expanded = signal(false);
        const sources = message.toolInvocations?.flatMap(ti => ti.result?.references ?? []) ?? [];
        const icon = compute((e): string => e ? "keyboard_arrow_down" : "keyboard_arrow_right", expanded);

        return when(sources.length > 0, create("div")
            .classes("flex-v", "small-gap", "no-wrap")
            .children(
                GenericTemplates.buttonWithIcon(icon, `${sources.length ?? 0} sources`, () => expanded.value = !expanded.value, ["expand-button"]),
                when(expanded, create("div")
                    .classes("flex-v", "small-gap")
                    .children(
                        ...sources.map(ChatTemplates.reference),
                    ).build())
            ).build());
    }

    private static reasoning(message: ChatMessage) {
        const expanded = signal(false);
        const hasReasoning = (message.reasoning?.length ?? 0) > 0;
        const icon = compute((e): string => e ? "keyboard_arrow_down" : "keyboard_arrow_right", expanded);

        return when(hasReasoning, create("div")
            .classes("flex-v", "small-gap", "no-wrap")
            .children(
                GenericTemplates.buttonWithIcon(icon, `Show reasoning`, () => expanded.value = !expanded.value, ["expand-button"]),
                when(expanded, create("div")
                    .classes("flex-v", "small-gap")
                    .children(
                        create("div")
                            .classes("reasoning", "flex-v", "small-gap")
                            .html(parseMarkdown((message.reasoning ?? []).reduce((acc, r) => {
                                if (r.type === "text") {
                                    acc += r.text;
                                } else {
                                    acc += "~~redacted reasoning~~";
                                }

                                return acc + "\r\n";
                            }, "")))
                            .build(),
                    ).build())
            ).build());
    }

    private static burgerButton(shown: Signal<boolean>) {
        return create("div")
            .classes("burger-button", compute(s => s ? "inline" : "absolute", shown))
            .children(
                GenericTemplates.iconButton(compute(s => s ? "close" : "menu", shown), "Close chat list", () => shown.value = !shown.value),
            ).build();
    }
}
