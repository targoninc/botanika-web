import {
    activateNextUpdate,
    availableModels,
    chatContext,
    chats,
    configuration,
    connected,
    currentChatId,
    currentlyPlayingAudio,
    currentText,
    currentUser,
    eventStore,
    shortCutConfig,
    target, ttsAvailable,
    updateChats,
} from "../utility/state/store";
import {GenericTemplates} from "./generic.templates";
import {ChatContext} from "../../models-shared/chat/ChatContext";
import {ChatMessage} from "../../models-shared/chat/ChatMessage";
import {attachCodeCopyButtons, createModal, toast} from "../utility/ui";
import {marked} from "marked";
import DOMPurify from 'dompurify';
import {ResourceReference} from "../../models-shared/chat/ResourceReference";
import {LlmProvider} from "../../models-shared/llms/llmProvider";
import {playAudio, stopAudio} from "../utility/audio/audio";
import {ProviderDefinition} from "../../models-shared/llms/ProviderDefinition";
import {AudioTemplates} from "./audio.templates";
import {compute, create, InputType, nullElement, Signal, signal, signalMap, when} from "@targoninc/jess";
import {button, input} from "@targoninc/jess-components";
import {featureOptions} from "../../models-shared/configuration/FeatureOptions.ts";
import {SettingConfiguration} from "../../models-shared/configuration/SettingConfiguration.ts";
import {focusChatInput, realtime} from "../index.ts";
import {BotanikaClientEventType} from "../../models-shared/websocket/clientEvents/botanikaClientEventType.ts";
import {NewMessageEventData} from "../../models-shared/websocket/clientEvents/newMessageEventData.ts";
import {MessageFile} from "../../models-shared/chat/MessageFile.ts";
import {attachFiles, handleDroppedFiles, pasteFile} from "../utility/files/attachFiles.ts";
import {Api} from "../utility/state/api.ts";
import hljs from "highlight.js";
import {FileTemplates} from "./file.templates.ts";
import {getHost} from "../utility/state/urlHelpers.ts";
import {llmProviderFeatureMap} from "../enums/LlmProviderFeatureMap.ts";
import {toHumanizedTime} from "../utility/toHumanizedTime.ts";
import {ChatListTemplates} from "./chat-list.templates.ts";
import {BotanikaClientEvent} from "../../models-shared/websocket/clientEvents/botanikaClientEvent.ts";
import {ChatNameChangedEventData} from "../../models-shared/websocket/clientEvents/chatNameChangedEventData.ts";
import {BotanikaServerEvent} from "../../models-shared/websocket/serverEvents/botanikaServerEvent.ts";
import {BotanikaServerEventType} from "../../models-shared/websocket/serverEvents/botanikaServerEventType.ts";
import {ChatUpdate} from "../../models-shared/chat/ChatUpdate.ts";
import {ToolCall} from "../../models-shared/chat/ToolCall.ts";
import {ReasoningDetail} from "../../api/ai/llms/aiMessage.ts";

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
            .classes("flex", "no-wrap", "no-gap", "relative", "restrict-to-parent")
            .children(
                ChatListTemplates.chatList("sidebar", menuShown),
                GenericTemplates.movableDivider(".chat-list.sidebar"),
                ChatTemplates.chatBox(menuShown),
                when(menuShown, ChatListTemplates.chatList("burger-menu", menuShown))
            ).build();
    }

    static chatBox(shown: Signal<boolean>) {
        return create("div")
            .classes("flex-v", "container", "relative", "no-gap", "no-padding", "chat-box")
            .children(
                ChatListTemplates.burgerButton(shown),
                ChatTemplates.botName(),
                ChatTemplates.chatHistory(),
                ChatTemplates.chatInput(),
            ).build();
    }

    static botName() {
        const chatName = compute(c => c.name ?? "New chat", chatContext);
        let timeoutId: NodeJS.Timeout;

        eventStore.subscribe((event) => {
            if (event.type !== "chatUpdate") {
                return;
            }

            const data = event.data as ChatUpdate;
            if (data.chatId === currentChatId.value && data.name) {
                chatName.value = data.name;
            }
        });

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
                input({
                    type: InputType.text,
                    classes: ["invisible-input"],
                    value: chatName,
                    name: "chatname-input",
                    onchange: (() => {
                        return (val: string) => {
                            clearTimeout(timeoutId);
                            timeoutId = setTimeout(() => {
                                if (val.length > 0) {
                                    realtime.send(<BotanikaClientEvent<ChatNameChangedEventData>>{
                                        type: BotanikaClientEventType.chatNameChanged,
                                        data: {
                                            chatId: currentChatId.value,
                                            name: val
                                        }
                                    });
                                }
                            }, 1000);
                        };
                    })()
                })
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
                document.querySelectorAll("a:not([target='_blank'])").forEach(a => {
                    (a as HTMLAnchorElement).target = "_blank";
                });
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
        const msg = signal(message);
        const text = compute(m => m.text, msg);
        const waiting = compute((c, t) => {
            const lastMessage = c?.history?.at(-1);
            return lastMessage && (lastMessage.type === "user" || !lastMessage.finished) && isLast && t.length === 0;
        }, chatContext, text);

        const update = (event: BotanikaServerEvent<any>) => {
            if (event.type !== BotanikaServerEventType.chatUpdate) {
                return;
            }

            const data = event.data as ChatUpdate;
            for (const m of (data.messages ?? [])) {
                if (m.id === message.id) {
                    msg.value = m;
                }
            }
        }

        eventStore.subscribe(update);

        return create("div")
            .classes("flex-v", "small-gap", "chat-message", message.type)
            .children(
                create("div")
                    .classes("flex", "message-time")
                    .children(
                        ChatTemplates.date(message.time),
                    ).build(),
                create("div")
                    .classes("flex-v", "message-content")
                    .children(
                        compute(m => ChatTemplates.toolCalls(m.toolInvocations), msg),
                        compute(m => ChatTemplates.reasoning(m.reasoning), msg),
                        create("div")
                            .html(compute(m => parseMarkdown(m.text), msg))
                            .build(),
                    ).build(),
                message.files && message.files.length > 0 ? ChatTemplates.messageFiles(message) : null,
                when(compute(m => m.finished, msg), ChatTemplates.messageActions(message)),
                when(waiting, GenericTemplates.spinner),
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
        const isOwnChat = compute((c, u) => u && (c.userId === u.id || !c.shared), chatContext, currentUser);
        const isAssistant = compute(i => message.type === "assistant" && i, isOwnChat);
        const ttsLoading = signal(false);
        const ttsVisible = compute((_, i, l) => ttsAvailable() && i && !l, configuration, isAssistant, ttsLoading);

        return create("div")
            .classes("flex", "align-center", "message-actions")
            .children(
                GenericTemplates.iconButton("content_copy", "Copy", async (e) => {
                    e.stopPropagation();
                    await navigator.clipboard.writeText(message.text);
                    toast("Copied to clipboard");
                }),
                when(ttsVisible, button({
                    disabled: audioDisabled,
                    icon: { icon: compute(a => a === message.id ? "stop" : "play_arrow", currentlyPlayingAudio) },
                    title: "Play audio",
                    onclick: () => {
                        if (currentlyPlayingAudio.value === message.id) {
                            stopAudio();
                        } else {
                            ttsLoading.value = true;
                            playAudio(message.id).then(() => ttsLoading.value = false);
                        }
                    },
                    classes: ["flex", "align-center", "icon-button"]
                })),
                when(ttsLoading, GenericTemplates.spinner()),
                when(compute(i => message.type === "user" && i, isOwnChat), GenericTemplates.iconButton("autorenew", "Retry with currently selected model", async (e) => {
                    e.stopPropagation();
                    createModal(GenericTemplates.confirmModal("Retry message", `This will delete all messages after the selected one and can not be reversed. Are you sure?`, "Yes", "No", async () => {
                        const r = await Api.deleteAfterMessage(chatContext.value.id, message.id, true);
                        if (r.success) {
                            updateChats(chats.value.map(c => {
                                if (c.id === chatContext.value.id) {
                                    const updatedChat = structuredClone(c);
                                    updatedChat.history = updatedChat.history.filter(m => m.time < message.time);
                                    return updatedChat;
                                }
                                return c;
                            }));
                            realtime.send({
                                type: BotanikaClientEventType.message,
                                data: <NewMessageEventData>{
                                    chatId: currentChatId.value,
                                    message: message.text,
                                    files: message.files,
                                    provider: configuration.value.provider,
                                    model: configuration.value.model,
                                }
                            })
                        }
                    }));
                })),
                when(isAssistant, GenericTemplates.iconButton("alt_route", "Branch within chat", async (e) => {
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
                when(compute(i => message.type === "assistant" && i, isOwnChat), GenericTemplates.iconButton("graph_1", "Branch to new chat", async (e) => {
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

    public static date(time: number, extended: boolean = false) {
        let formatted = toHumanizedTime(time);
        if (extended) {
            formatted = signal(new Date(time).toLocaleString("default", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
            }));
        }

        return create("span")
            .classes("time")
            .text(formatted)
            .build();
    }

    static chatInput() {
        const input = currentText;
        const chatId = compute(c => c?.id, chatContext);
        const provider = compute(c => c.provider, configuration);
        const modelConfigured = compute(c => c.model !== undefined && c.model.length > 0, configuration);
        const model = compute((c, conf) => conf ? c.model : "No model selected", configuration, modelConfigured);
        const files = signal<MessageFile[]>([]);
        const focusInput = () => {
            document.getElementById("chat-input-field")?.focus();
        }
        const updateInputHeight = () => {
            const field = document.getElementById("chat-input-field");
            if (!field) {
                return;
            }
            field.style.height = "auto";
            if (input.value.length > 0) {
                field.style.height = Math.min(field.scrollHeight, 300) + "px";
            } else {
                field.style.height = "auto";
            }
        }
        input.subscribe(updateInputHeight);
        const flyoutVisible = signal(false);
        const isDraggingOver = signal(false);
        const hasText = compute(i => i.length > 0, input);
        const sendButtonClass = compute((h): string => h ? "has-text" : "_", hasText);
        const voiceConfigured = compute(c => c && !!c.transcriptionModel && !!c.transcriptionProvider, configuration);
        const generating = compute((c) => {
            const lastMessage = c?.history?.at(-1);
            return lastMessage && (lastMessage.type === "user" || !lastMessage.finished);
        }, chatContext);
        const stopButtonClass = compute((g): string => g ? "_" : "hidden", generating);
        const sendingDisabled = compute((g, h) => g || !h, generating, hasText);
        const disabledClass = compute((d): string => d ? "disabled" : "_", sendingDisabled);
        const noHistory = compute(c => (c?.history?.length ?? 0) === 0, chatContext);
        const noHistoryClass = compute((c): string => c?.history?.length > 0 ? "_" : "no-history", chatContext);
        const entirelyDisabled = compute((c, u) => c && c.userId && u && c.userId !== u.id, chatContext, currentUser);
        const entirelyDisabledClass = compute((d): string => d ? "disabled" : "_", entirelyDisabled);

        const send = () => {
            if (sendingDisabled.value) {
                return;
            }

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

        return create("div")
            .classes("chat-input", noHistoryClass, entirelyDisabledClass)
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
                                        when(voiceConfigured, AudioTemplates.voiceButton(generating)),
                                        GenericTemplates.verticalButtonWithIcon("stop_circle", "", () => {
                                            realtime.send({
                                                type: BotanikaClientEventType.generationStopped,
                                                data: {
                                                    chatId: chatId.value
                                                }
                                            });
                                        }, ["stop-button", stopButtonClass]),
                                        when(generating, GenericTemplates.verticalButtonWithIcon("arrow_upward", "", send, ["send-button", sendButtonClass, disabledClass]), true),
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
            .placeholder(compute((c, conf) => conf ? `[Ctrl] + [Shift] + [${c.focusInput === " " ? "Space" : c.focusInput}] to focus` : "Configure a provider and model before you can chat", shortCutConfig, configured))
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
            const feat = llmProviderFeatureMap[p];
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
        const currentProvider = compute(c => c.provider, configuration);
        const currentModel = compute(c => c.model, configuration);

        currentProvider.subscribe((p) => configured.value = p !== undefined && currentModel.value !== undefined);
        currentModel.subscribe((m) => configured.value = m !== undefined && currentProvider.value !== undefined);

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

    private static selectorPane(p: { id: string, displayName: string }[], selected: Signal<string>, setValue: (str: string) => void) {
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

    private static toolCalls(toolInvocations: ToolCall[]) {
        const expanded = signal(false);
        const sources = toolInvocations?.flatMap(ti => ti.result?.references ?? []) ?? [];
        const icon = compute((e): string => e ? "keyboard_arrow_down" : "keyboard_arrow_right", expanded);

        return create("div")
            .children(
                when(sources.length > 0, create("div")
                    .classes("flex-v", "small-gap", "no-wrap")
                    .children(
                        GenericTemplates.buttonWithIcon(icon, `${sources.length ?? 0} sources`, () => expanded.value = !expanded.value, ["expand-button"]),
                        when(expanded, create("div")
                            .classes("flex-v", "small-gap")
                            .children(
                                ...sources.map(ChatTemplates.reference),
                            ).build())
                    ).build())
            ).build();
    }

    private static reasoning(reasoning: ReasoningDetail[]) {
        const expanded = signal(false);
        const hasReasoning = (reasoning?.length ?? 0) > 0;
        const icon = compute((e): string => e ? "keyboard_arrow_down" : "keyboard_arrow_right", expanded);

        return create("div")
            .children(
                when(hasReasoning, create("div")
                    .classes("flex-v", "small-gap", "no-wrap")
                    .children(
                        GenericTemplates.buttonWithIcon(icon, `Show reasoning`, () => expanded.value = !expanded.value, ["expand-button"]),
                        when(expanded, create("div")
                            .classes("flex-v", "small-gap")
                            .children(
                                create("div")
                                    .classes("reasoning", "flex-v", "small-gap")
                                    .html(parseMarkdown((reasoning ?? []).reduce((acc, r) => {
                                        if (r.type === "text") {
                                            acc += r.text;
                                        } else {
                                            acc += "~~redacted reasoning~~";
                                        }

                                        return acc + "\r\n";
                                    }, "")))
                                    .build(),
                            ).build())
                    ).build())
            ).build();
    }
}
