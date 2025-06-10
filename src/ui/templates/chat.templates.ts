import {
    activateChat,
    activePage,
    availableModels,
    chatContext,
    chats,
    configuration,
    currentlyPlayingAudio,
    currentText,
    deleteChat,
    shortCutConfig,
    target, updateChats,
} from "../classes/store";
import {GenericTemplates} from "./generic.templates";
import {ChatContext} from "../../models/chat/ChatContext";
import {ChatMessage} from "../../models/chat/ChatMessage";
import {Api} from "../classes/api";
import {attachCodeCopyButtons, createModal, toast} from "../classes/ui";
import {marked} from "marked";
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import {ResourceReference} from "../../models/chat/ResourceReference";
import {INITIAL_CONTEXT} from "../../models/chat/initialContext";
import {ModelDefinition} from "../../models/llms/ModelDefinition";
import {LlmProvider} from "../../models/llms/llmProvider";
import {playAudio, stopAudio} from "../classes/audio/audio";
import {ProviderDefinition} from "../../models/llms/ProviderDefinition";
import {AudioTemplates} from "./audio.templates";
import {AnyNode, compute, create, nullElement, Signal, signal, signalMap, when} from "@targoninc/jess";
import {button, icon} from "@targoninc/jess-components";
import {BotanikaFeature} from "../../models/features/BotanikaFeature.ts";
import {featureOptions} from "../../models/features/featureOptions.ts";
import {SettingConfiguration} from "../../models/uiExtensions/SettingConfiguration.ts";
import {realtime} from "../index.ts";
import {BotanikaClientEventType} from "../../models/websocket/clientEvents/botanikaClientEventType.ts";
import {NewMessageEventData} from "../../models/websocket/clientEvents/newMessageEventData.ts";
import {MessageFile} from "../../models/chat/MessageFile.ts";
import {attachFiles} from "../classes/attachFiles.ts";
import {pasteFile} from "../classes/pasteFile.ts";
import {handleDroppedFiles} from "../classes/handleDroppedFiles.ts";

export class ChatTemplates {
    static chat() {
        return create("div")
            .classes("flex", "flex-grow", "no-wrap", "relative")
            .children(
                ChatTemplates.chatList(),
                ChatTemplates.chatBox(),
            ).build();
    }

    static chatBox() {
        const scrollPosition = signal(0);

        return create("div")
            .classes("flex-v", "flex-grow", "bordered-panel", "relative", "chat-box", "no-gap")
            .children(
                ChatTemplates.botName(),
                compute(c => ChatTemplates.chatHistory(c, scrollPosition), chatContext),
                ChatTemplates.chatInput(),
            ).build();
    }

    static botName() {
        return create("div")
            .classes("flex", "align-center", "bot-name", "card")
            .children(
                GenericTemplates.icon("person"),
                create("span")
                    .text(compute(c => c.botname ?? "Anika", configuration))
                    .build()
            ).build();
    }

    static chatHistory(context: ChatContext, scrollPosition: Signal<number>) {
        if (!context || !context.history) {
            return create("div")
                .classes("flex-v", "flex-grow")
                .styles("overflow-y", "auto")
                .text("No messages yet")
                .build();
        }

        const dedupHistory = context.history.reduce((prev, cur) => {
            if (!prev.some(h => h.id === cur.id)) {
                prev.push(cur);
            }
            return prev;
        }, []);
        const lastMessageIsUser = dedupHistory.at(-1)?.type === "user";

        const hist = create("div")
            .classes("flex-v", "flex-grow", "chat-history")
            .styles("overflow-y", "auto")
            .onwheel(() => {
                if (hist.scrollHeight > 0) {
                    scrollPosition.value = hist.scrollTop;
                }
            })
            .children(
                create("div")
                    .classes("restrict-width-small", "flex-v")
                    .children(
                        ...dedupHistory
                            .sort((a, b) => a.time - b.time)
                            .map(message => ChatTemplates.chatMessage(message)),
                        when(lastMessageIsUser, GenericTemplates.spinner()),
                        GenericTemplates.spacer()
                    ).build()
            ).build();

        setTimeout(() => {
            hljs.highlightAll();
            attachCodeCopyButtons();
        });

        return hist;
    }

    private static chatMessage(message: ChatMessage) {
        if (message.type === "tool") {
            const textIsJson = typeof message.text.constructor === "object";

            return create("div")
                .classes("flex-v", "small-gap", "bordered-panel")
                .children(
                    create("div")
                        .classes("flex", "align-center", "chat-message", message.type)
                        .children(
                            GenericTemplates.icon("build_circle"),
                            textIsJson ? GenericTemplates.properties(JSON.parse(message.text))
                                : create("span")
                                    .text(message.text)
                                    .build(),
                        ).build(),
                    (message.references && message.references.length > 0) ? create("div")
                        .classes("flex-v", "small-gap", "chat-message-references")
                        .children(
                            ...(message.references ?? []).map(r => ChatTemplates.reference(r)),
                        ).build() : null,
                    !message.finished ? GenericTemplates.spinner() : null,
                ).build();
        }

        if (message.text.trim().length === 0) {
            return nullElement();
        }

        const rawMdParsed = marked.parse(message.text, {
            async: false
        });
        const sanitized = DOMPurify.sanitize(rawMdParsed);

        return create("div")
            .classes("flex-v", "small-gap", "chat-message", message.type)
            .children(
                create("div")
                    .classes("flex", "align-center", "message-time")
                    .children(
                        ChatTemplates.date(message.time),
                    ).build(),
                create("div")
                    .classes("flex", "align-center", "card", "message-content")
                    .children(
                        create("div")
                            .html(sanitized)
                            .build(),
                        !message.finished ? GenericTemplates.spinner() : null,
                    ).build(),
                message.files && message.files.length > 0 ? ChatTemplates.messageFiles(message) : null,
                ChatTemplates.messageActions(message),
            ).build();
    }

    private static messageFiles(message: ChatMessage) {
        return create("div")
            .classes("flex", "align-center", "card", "message-content")
            .children(
                ...message.files.map(f => {
                    if (f.mimeType.startsWith("image/")) {
                        return create("img")
                            .classes("message-content-image")
                            .src(`data:${f.mimeType};base64,` + f.base64)
                            .build();
                    }

                    if (f.mimeType === "application/pdf") {
                        return ChatTemplates.fillButton("open_in_new", f.name, () => {
                            window.open(`data:${f.mimeType};base64,` + f.base64, "_blank");
                        });
                    }

                    return button({
                        icon: {icon: "download"},
                        text: "File",
                        onclick: () => {
                            const a = document.createElement("a");
                            a.href = f.base64;
                            a.download = `file.${f.mimeType.split("/")[1]}`;
                            document.body.appendChild(a);
                            a.click();
                        }
                    })
                }),
            ).build();
    }

    static messageActions(message: ChatMessage) {
        const audioDisabled = compute(a => !!a && a !== message.id, currentlyPlayingAudio);
        const modelInfo = "Through API from " + message.provider + ", model: " + message.model;
        const branchableTypes = ["user", "assistant"];

        return create("div")
            .classes("flex", "align-center")
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
                    classes: ["flex", "align-center"]
                }) : null,
                ChatTemplates.messageAction("content_copy", "Copy", async (e) => {
                    e.stopPropagation();
                    await navigator.clipboard.writeText(message.text);
                    toast("Copied to clipboard");
                }),
                when(message.type === "user", ChatTemplates.messageAction("delete", "Delete history after this message", async (e) => {
                    e.stopPropagation();
                    createModal(GenericTemplates.confirmModal("Delete history after message", `Are you sure you want to delete all messages after this?`, "Yes", "No", async () => {
                        const r = await Api.deleteAfterMessage(chatContext.value.id, message.id);
                        if (r.success) {
                            const c = structuredClone(chatContext.value);
                            const messageIndex = c.history.map(m => m.id).indexOf(message.id);
                            c.history.splice(messageIndex);
                            chatContext.value = c;
                        }
                    }));
                })),
                when(branchableTypes.includes(message.type), ChatTemplates.messageAction("graph_1", "Branch from here", async (e) => {
                    e.stopPropagation();
                    const r = await Api.branchFromMessage(chatContext.value.id, message.id);
                    if (r.success) {
                        const newContext = r.data as ChatContext;
                        updateChats([
                            ...chats.value,
                            newContext
                        ]);
                        chatContext.value = newContext;
                    }
                })),
                GenericTemplates.icon("info", [], modelInfo)
            ).build();
    }

    static messageAction(icon: string, text: string, onclick: (e: any) => void) {
        return button({
            icon: { icon },
            classes: ["flex", "align-center", "message-action"],
            title: text,
            onclick
        });
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
        const model = compute(c => c.model, configuration);
        const files = signal<MessageFile[]>([]);
        const send = () => {
            try {
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
            const input = document.getElementById("chat-input-field");
            if (!input) {
                return;
            }
            input.style.height = "auto";
            input.style.height = Math.min(input.scrollHeight, 300) + "px";
        }
        input.subscribe(() => {
            updateInputHeight();
        });
        const voiceConfigured = compute(c => c && !!c.transcriptionModel, configuration);
        const flyoutVisible = signal(false);
        const isDraggingOver = signal(false);

        return create("div")
            .classes("chat-input", "relative", "flex-v", "small-gap")
            .classes(compute(d => d ? "drag-over" : "_", isDraggingOver))
            .ondragover((e: DragEvent) => {
                e.preventDefault();
                isDraggingOver.value = true;
            })
            .ondragleave(() => {
                isDraggingOver.value = false;
            })
            .ondrop((e: DragEvent) => {
                isDraggingOver.value = false;
                handleDroppedFiles(e, files);
            })
            .children(
                create("div")
                    .classes("flex", "space-between")
                    .onclick(focusInput)
                    .children(
                        create("div")
                            .classes("flex-v", "flex-grow")
                            .children(
                                when(compute(f => f.length > 0, files), ChatTemplates.filesDisplay(files)),
                                ChatTemplates.actualChatInput(input, send, files),
                            ).build(),
                    ).build(),
                create("div")
                    .classes("flex", "align-center", "space-between")
                    .children(
                        create("div")
                            .classes("flex")
                            .children(
                                create("div")
                                    .classes("relative")
                                    .children(
                                        GenericTemplates.buttonWithIcon("settings", model, () => flyoutVisible.value = !flyoutVisible.value),
                                        when(flyoutVisible, ChatTemplates.settingsFlyout()),
                                    ).build(),
                                GenericTemplates.buttonWithIcon("attach_file", "Attach files", () => attachFiles(files)),
                            ).build(),
                        create("div")
                            .classes("flex", "align-center")
                            .children(
                                when(voiceConfigured, AudioTemplates.voiceButton()),
                                GenericTemplates.verticalButtonWithIcon("arrow_upward", "", send, ["send-button"]),
                            ).build(),
                    ).build(),
            ).build();
    }

    static settingsFlyout() {
        return create("div")
            .classes("flex-v", "flyout", "above", "right")
            .children(
                ChatTemplates.llmSelector(),
            ).build();
    }

    private static actualChatInput(input: Signal<string>, send: () => void, files: Signal<MessageFile[]>) {
        return create("textarea")
            .attributes("rows", "3")
            .id("chat-input-field")
            .classes("flex-grow", "chat-input-field", "full-width")
            .styles("resize", "none")
            .placeholder(compute(c => `[Shift] + [${c.focusInput}] to focus`, shortCutConfig))
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

    static llmSelector() {
        const providerFeatureMap: Record<LlmProvider, BotanikaFeature> = {
            [LlmProvider.openai]: BotanikaFeature.OpenAI,
            [LlmProvider.ollama]: BotanikaFeature.Ollama,
            [LlmProvider.groq]: BotanikaFeature.Groq,
            [LlmProvider.azure]: BotanikaFeature.Azure,
            [LlmProvider.openrouter]: BotanikaFeature.OpenRouter,
        };
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

        return create("div")
            .classes("flex-v", "select-container")
            .children(
                when(anyProvider, create("div")
                    .classes("flex")
                    .children(
                        compute(p => GenericTemplates.select("Provider", p.map(m => {
                            return {
                                value: m,
                                text: m
                            };
                        }), provider, setProvider), availableProviders),
                    ).build()),
                compute((p, a) => {
                    if (!a[p] || Object.keys(a).length === 0) {
                        return nullElement();
                    }
                    return ChatTemplates.modelSelector(a[p].models ?? []);
                }, provider, filteredModels),
                when(anyProvider, GenericTemplates.warning("No provider configured, go to settings"), true),
            ).build();
    }

    private static modelSelector(models: ModelDefinition[]) {
        const model = compute(c => c.model, configuration);

        return GenericTemplates.select("Model", models.sort((a, b) => a.id.localeCompare(b.id))
            .map(m => {
                return {
                    value: m.id,
                    text: m.id
                };
            }), model, async (newModel) => {
            configuration.value = {
                ...configuration.value,
                model: newModel
            };
            await Api.setConfigKey("model", newModel);
        });
    }

    private static chatList() {
        const newDisabled = compute(c => Object.keys(c).length === 0, chatContext);
        const userPopupVisible = signal(false);

        return create("div")
            .classes("flex-v", "bordered-panel", "chat-list")
            .children(
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
                                chatContext.value = INITIAL_CONTEXT;
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
                compute(c => ChatTemplates.chatListItems(c), chats),
            ).build();
    }

    static chatListItems(chat: ChatContext[]) {
        return create("div")
            .classes("flex-v", "flex-grow")
            .children(
                when(chat.length === 0, create("span")
                    .text("No chats yet")
                    .build()
                ),
                ...chat.map(chatId => ChatTemplates.chatListItem(chatId))
            ).build();
    }

    static chatListItem(chat: ChatContext) {
        const active = compute(c => c && c.id === chat.id, chatContext);
        const activeClass = compute((c): string => c ? "active" : "_", active);

        return create("div")
            .classes("flex-v", "small-gap", "chat-list-item", activeClass)
            .onclick(() => activateChat(chat))
            .children(
                create("div")
                    .classes("flex", "align-center", "no-wrap", "space-between")
                    .children(
                        create("span")
                            .text(chat.name)
                            .build(),
                        button({
                            icon: {
                                icon: "delete",
                            },
                            classes: ["flex", "align-center"],
                            onclick: (e) => {
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
                            }
                        })
                    ).build(),
                ChatTemplates.date(chat.createdAt),
            ).build();
    }

    private static reference(r: ResourceReference) {
        const expanded = signal(false);
        const expandedClass = compute((e): string => e ? "expanded" : "_", expanded);

        return create("div")
            .classes("flex-v", "no-gap", "relative", "reference", r.link ? "clickable" : "_", expandedClass)
            .onclick(() => {
                if (!r.snippet) {
                    return;
                }

                expanded.value = !expanded.value;
            })
            .children(
                create("div")
                    .classes("flex", "align-center", "padded", "pill-padding", "no-wrap")
                    .children(
                        r.link ? GenericTemplates.icon("link") : null,
                        (r.link && !r.link.startsWith("file://")) ? create("a")
                                .href(r.link)
                                .target("_blank")
                                .title(r.link)
                                .text(r.name)
                                .build()
                            : create("span")
                                .classes("text-small")
                                .text(r.name)
                                .build(),
                    ).build(),
                r.snippet ? create("div")
                        .classes("flex", "small-gap", "reference-preview", "padded-big")
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

    private static filesDisplay(files: Signal<MessageFile[]>) {
        return create("div")
            .children(
                signalMap(files, create("div").classes("flex"), f => ChatTemplates.fileDisplay(files, f))
            ).build();
    }

    private static fileDisplay(files: Signal<MessageFile[]>, file: MessageFile) {
        let content: AnyNode;
        let width = "5em";
        if (file.mimeType.startsWith("image/")) {
            content = create("img")
                .classes("file-display-image")
                .src(`data:${file.mimeType};base64,` + file.base64)
                .build();
        } else if (file.mimeType.startsWith("audio/")) {
            width = "10em";
            content = create("audio")
                .attributes("controls", "")
                .classes("file-display-image")
                .src(`data:${file.mimeType};base64,` + file.base64)
                .build();
        } else if (file.mimeType === "application/pdf") {
            width = "10em";
            content = ChatTemplates.fillButton("open_in_new", file.name, () => {
                window.open(`data:${file.mimeType};base64,` + file.base64, "_blank");
            });
        } else {
            content = create("span")
                .text(file.name ?? file.mimeType)
                .build();
        }

        return create("div")
            .classes("file-display", "relative")
            .styles("min-width", width, "max-width", width)
            .children(
                content,
                create("div")
                    .classes("file-actions")
                    .children(
                        GenericTemplates.buttonWithIcon("close", "", () => files.value = files.value.filter(f => f.id !== file.id)),
                    ).build()
            ).build();
    }

    private static fillButton(iconStr: string, text: string, onclick: () => void) {
        return create("div")
            .classes("full-width", "full-height", "flex", "card", "clickable", "align-children", "center-content")
            .onclick(onclick)
            .children(
                create("div")
                    .classes("flex-v", "small-gap")
                    .children(
                        icon({
                            icon: iconStr,
                        }),
                        create("span")
                            .classes("text-small")
                            .text(text)
                            .build()
                    ).build()
            ).build();
    }
}
