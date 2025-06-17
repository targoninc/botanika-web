import {GenericTemplates} from "./generic.templates";
import {SettingConfiguration} from "../../models/uiExtensions/SettingConfiguration";
import {createModal, toast} from "../classes/ui";
import {ShortcutConfiguration} from "../../models/shortcuts/ShortcutConfiguration";
import {shortcutNames} from "../../models/shortcuts/Shortcut";
import {McpServerConfig} from "../../models/mcp/McpServerConfig";
import {Configuration} from "../../models/Configuration";
import {featureOptions} from "../../models/features/featureOptions";
import {compute, create, InputType, nullElement, Signal, signal, signalMap, when} from "@targoninc/jess";
import {button, input} from "@targoninc/jess-components";
import {BotanikaFeature} from "../../models/features/BotanikaFeature.ts";
import {ToastType} from "../enums/ToastType.ts";
import {activePage, configuration, mcpConfig, shortCutConfig} from "../classes/state/store.ts";
import {Api} from "../classes/state/api.ts";
import {v4} from "uuid";
import {Tab} from "../../models/uiExtensions/Tab.ts";
import {TranscriptionProvider} from "../../models/transcriptionProvider.ts";

export class SettingsTemplates {
    static settings() {
        const settings: SettingConfiguration[] = [
            {
                key: "display_hotkeys",
                icon: "keyboard",
                label: "Display hotkeys",
                description: "Whether to display hotkeys in the UI.",
                type: "boolean",
            },
            {
                key: "enableStt",
                icon: "mic",
                label: "Enable transcription",
                description: "Whether transcription of what you say should be enabled",
                type: "boolean",
            },
            {
                key: "transcriptionProvider",
                icon: "transcribe",
                label: "Transcription Provider",
                description: `Which transcription provider to use.`,
                type: "select",
                options: [TranscriptionProvider.openai, TranscriptionProvider.groq]
            },
            {
                key: "transcriptionModel",
                icon: "transcribe",
                label: "Transcription Model",
                description: `Find available models: https://ai-sdk.dev/docs/ai-sdk-core/transcription#transcription-models`,
                type: "string",
            },
            {
                key: "enableTts",
                icon: "text_to_speech",
                label: "Enable text to speech",
                description: "Whether assistant messages should be spoken aloud",
                type: "boolean",
            },
            {
                key: "botname",
                label: "Assistant name",
                description: "What name LLMs will use to refer to themselves",
                type: "string",
            },
            {
                key: "botDescription",
                label: "What should the assistant be like?",
                description: "The assistant will try to align with this description",
                type: "long-string",
            },
            {
                key: "displayname",
                icon: "person",
                label: "Your name",
                description: "Displayed in the UI",
                type: "string",
            },
            {
                key: "userDescription",
                label: "A short description of yourself",
                description: "Will be given to the model(s) as context",
                type: "long-string",
            },
            {
                key: "birthdate",
                icon: "calendar_month",
                label: "Your birthdate",
                description: "Will be given to the model(s) as context",
                type: "date",
            },
            {
                key: "maxSteps",
                icon: "checklist",
                label: "Maximum steps per call",
                description: "Maximum amount of iterations each message you send will trigger",
                type: "number",
            },
            {
                key: "tintColor",
                icon: "colors",
                label: "UI tint color",
                description: "What color to slightly tint the UI with.",
                type: "color",
            }
        ];
        const loading = signal(false);
        const tabs = signal<Tab[]>([
            {
                name: "General",
                icon: "settings",
                id: "general",
            },
            {
                name: "Keys",
                icon: "key",
                id: "keys",
            },
            {
                name: "MCP",
                icon: "linked_services",
                id: "mcp",
            }
        ])
        const activeTab = signal("general");

        return create("div")
            .classes("flex-v", "container", "overflow", "restrict-to-parent")
            .children(
                create("div")
                    .classes("flex-v", "restrict-width")
                    .children(
                        GenericTemplates.buttonWithIcon("chevron_left", "Back to chat", async () => {
                            activePage.value = "chat";
                        }, ["fixed", "layer-shadow"]),
                        SettingsTemplates.settingsHeader(loading),
                        GenericTemplates.tabs([
                            SettingsTemplates.generalSettings(settings, loading),
                            SettingsTemplates.configuredFeatures(),
                            SettingsTemplates.mcpConfig(),
                        ], tabs, activeTab),
                        GenericTemplates.spacer()
                    ).build()
            ).build();
    }

    private static generalSettings(settings: SettingConfiguration[], loading: Signal<boolean>) {
        return create("div")
            .classes("flex-v")
            .children(
                GenericTemplates.heading(2, "General"),
                ...settings.map(s => SettingsTemplates.setting(s, loading, c => c[s.key], (c, k, v) => ({
                    ...c,
                    [k]: v
                }))),
                SettingsTemplates.shortcuts()
            ).build();
    }

    private static settingsHeader(loading: Signal<boolean>) {
        return create("div")
            .classes("flex-v")
            .children(
                create("h1")
                    .classes("flex")
                    .styles("margin-top", "1.5em")
                    .children(
                        create("span")
                            .text("Settings")
                            .build(),
                        when(loading, GenericTemplates.spinner()),
                    ).build(),
                GenericTemplates.warning("All data will be saved in this instance's database. Learn how to host your own instance: "),
                GenericTemplates.buttonWithIcon("open_in_new", "GitHub Repository", () => window.open("https://github.com/targoninc/botanika-web", "_blank")),
            ).build();
    }

    static setting(sc: SettingConfiguration, loading: Signal<boolean>, getter: (config: Configuration) => any, updateFunction: (config: Configuration, key: string, value: any) => Configuration) {
        const errors = signal<string[]>([]);
        async function updateKey(key: string, value: any, notifyOnChange = true) {
            if (sc.validator) {
                const valErrors = sc.validator(value);
                errors.value = valErrors;
                if (valErrors.length > 0) {
                    return;
                }
            }

            loading.value = true;
            configuration.value = updateFunction(configuration.value, key, value);
            await Api.setConfig(configuration.value);
            if (notifyOnChange) {
                toast("Configuration updated", null, ToastType.positive);
            }
            loading.value = false;
        }

        const value = compute(c => getter(c) ?? null, configuration);
        if (sc.type === "color") {
            let debounceTimeout: number | null = null;
            value.subscribe((val, changed) => {
                if (!changed) {
                    return;
                }

                if (debounceTimeout) {
                    clearTimeout(debounceTimeout);
                }

                // @ts-expect-error because ts is stupid here
                debounceTimeout = setTimeout(() => {
                    updateKey(sc.key, val, false).then();
                    debounceTimeout = null;
                }, 200);
            });
        }
        const changed = compute((v, c) => v !== (getter(c) ?? null) && sc.type !== "boolean", value, configuration);

        return create("div")
            .classes("flex-v", "card", "small-gap")
            .children(
                create("div")
                    .classes("flex", "align-center")
                    .children(
                        sc.icon ? create("h3")
                            .children(
                                GenericTemplates.icon(sc.icon),
                            ).build() : null,
                        SettingsTemplates.settingImplementation(sc, value, async (_, val) => {
                            value.value = val;
                            if (sc.type === "boolean") {
                                await updateKey(sc.key, value.value);
                            }
                        }),
                        when(changed, button({
                            icon: {icon: "save"},
                            text: "Set",
                            classes: ["flex", "align-center"],
                            onclick: () => updateKey(sc.key, value.value)
                        })),
                    ).build(),
                when(sc.description, create("span")
                    .classes("text-small")
                    .text(sc.description)
                    .build()),
                signalMap(errors, create("div").classes("flex-v"), e => create("span")
                    .classes("error")
                    .text(e)
                    .build())
            ).build();
    }

    private static settingImplementation(sc: SettingConfiguration, value: Signal<any>, updateKey: (key: string, value: any) => Promise<void>) {
        switch (sc.type) {
            case "string":
                return GenericTemplates.input(InputType.text, sc.key, value, sc.label, sc.label, sc.key, [], (newValue) => updateKey(sc.key, newValue));
            case "select":
                return GenericTemplates.select(sc.label, (sc.options ?? []).map(o => ({ text: o, value: o })), value, (newValue) => updateKey(sc.key, newValue));
            case "password":
                return GenericTemplates.input(InputType.password, sc.key, value, sc.label, sc.label, sc.key, [], (newValue) => updateKey(sc.key, newValue));
            case "color":
                return create("div")
                    .classes("flex-v", "small-gap")
                    .children(
                        GenericTemplates.input(InputType.color, sc.key, value, sc.label, sc.label, sc.key, [], (newValue) => updateKey(sc.key, newValue)),
                        GenericTemplates.input(InputType.text, sc.key, value, sc.label, "", sc.key, [], (newValue) => updateKey(sc.key, newValue)),
                    ).build();
            case "date":
                return GenericTemplates.input(InputType.date, sc.key, value, sc.label, sc.label, sc.key, [], (newValue) => updateKey(sc.key, newValue));
            case "long-string":
                return GenericTemplates.textArea(value, sc.label, sc.key, (newValue) => updateKey(sc.key, newValue));
            case "number":
                return GenericTemplates.input(InputType.number, sc.key, value, sc.label, sc.label, sc.key, [], (newValue: string) => updateKey(sc.key, parseInt(newValue)));
            case "boolean":
                return GenericTemplates.toggle(sc.label, value, val => updateKey(sc.key, val));
            case "language":
                return GenericTemplates.select(sc.label, [
                    {
                        text: "English",
                        value: "en",
                    },
                    {
                        text: "Deutsch",
                        value: "de",
                    },
                ], value, val => updateKey(sc.key, val));
            default:
                return nullElement();
        }
    }

    static configuredFeatures() {
        return create("div")
            .classes("flex-v", "allow-overflow")
            .children(
                compute(a => SettingsTemplates.configuredFeaturesInternal(a), configuration)
            ).build();
    }

    static configuredFeaturesInternal(config: Configuration) {
        return create("div")
            .classes("flex-v")
            .children(
                GenericTemplates.heading(2, "Configured APIs"),
                ...Object.keys(featureOptions).map((api: BotanikaFeature) => {
                    const features = (config.featureOptions ?? {})[api] as Record<string, any> ?? {};
                    const fOptions = featureOptions[api];
                    const loading = signal(false);
                    const allSet = fOptions.every(f => !!features[f.key]);

                    const settingsList = fOptions && fOptions.length > 0 ? fOptions.map(s => SettingsTemplates.setting(s, loading, c => {
                        return c.featureOptions && c.featureOptions[api] ? c.featureOptions[api][s.key] : null;
                    }, (c, k, v) => (<Configuration>{
                        ...c,
                        featureOptions: {
                            ...(c.featureOptions ?? {}),
                            [api]: {
                                ...((c.featureOptions ?? {})[api] ?? {}),
                                [k]: v,
                            }
                        }
                    }))) : [];

                    return create("div")
                        .classes("flex-v")
                        .children(
                            create("div")
                                .classes("flex", allSet ? "positive" : "negative")
                                .children(
                                    GenericTemplates.icon(allSet ? "check" : "key_off", [allSet ? "positive" : "negative"]),
                                    create("b")
                                        .text(api),
                                    when(loading, GenericTemplates.spinner())
                                ).build(),
                            ...settingsList,
                        ).build();
                })
            ).build();
    }

    static mcpConfig() {
        return create("div")
            .classes("flex-v", "allow-overflow")
            .children(
                compute(c => SettingsTemplates.mcpConfigInternal(c ?? []), mcpConfig)
            ).build();
    }

    static mcpConfigInternal(servers: McpServerConfig[]) {
        return create("div")
            .classes("flex-v")
            .children(
                GenericTemplates.heading(2, "Configured MCP servers"),
                ...(servers ?? []).map(SettingsTemplates.existingMcpServer),
                SettingsTemplates.addMcpServer()
            ).build();
    }

    private static addMcpServer() {
        const name = signal("");
        const url = signal("http://localhost:MCP_PORT/path/sse");

        return create("div")
            .classes("flex-v", "card")
            .children(
                create("p")
                    .text("Add a new MCP server:"),
                create("div")
                    .classes("flex", "align-center")
                    .children(
                        input({
                            type: InputType.text,
                            value: name,
                            name: "name",
                            label: "Name",
                            placeholder: "Name",
                            onchange: (value) => name.value = value
                        }),
                        input({
                            type: InputType.text,
                            value: url,
                            name: "url",
                            label: "URL",
                            placeholder: "URL",
                            onchange: (value) => url.value = value
                        })
                    ).build(),
                button({
                    text: "Add",
                    disabled: compute((n, u) => n.length === 0 || u.length === 0, name, url),
                    icon: {
                        icon: "add",
                    },
                    classes: ["flex", "align-center", "positive"],
                    onclick: () => {
                        const newServers = [...mcpConfig.value, <McpServerConfig>{
                            url: url.value,
                            name: name.value,
                            id: v4(),
                            headers: {}
                        }];

                        Api.setMcpConfig(newServers).then(() => {
                            Api.getMcpConfig().then(mcpConf => {
                                if (mcpConf.data) {
                                    mcpConfig.value = mcpConf.data as McpServerConfig[];
                                }
                            });
                        });
                    }
                })
            ).build();
    }

    private static existingMcpServer(server: McpServerConfig) {
        const name = signal(server.name);
        const url = signal(server.url);
        const headers = signal(server.headers);

        return create("div")
            .classes("flex-v", "bordered-panel")
            .children(
                create("div")
                    .classes("flex")
                    .children(
                        SettingsTemplates.mcpServerSaveButton(name, url, server, headers),
                        GenericTemplates.buttonWithIcon("delete", "Delete", () => {
                            createModal(GenericTemplates.confirmModal("Delete MCP Server connection", `Are you sure you want to delete ${server.url}?`, "Yes", "No", () => {
                                const newServers = [...mcpConfig.value].filter(s => s.id !== server.id);
                                Api.setMcpConfig(newServers).then(() => {
                                    Api.getMcpConfig().then(mcpConf => {
                                        if (mcpConf.data) {
                                            mcpConfig.value = mcpConf.data as McpServerConfig[];
                                        }
                                    });
                                });
                            }));
                        }, ["negative"]),
                    ).build(),
                create("div")
                    .classes("flex", "align-center")
                    .children(
                        input({
                            type: InputType.text,
                            value: name,
                            name: "name",
                            label: "Name",
                            placeholder: "Name",
                            onchange: (value) => {
                                name.value = value;
                            }
                        }),
                        input({
                            type: InputType.text,
                            value: server.url,
                            name: "url",
                            label: "URL",
                            placeholder: "URL",
                            onchange: (value) => {
                                url.value = value;
                            }
                        })
                    ).build(),
                create("div")
                    .classes("flex-v")
                    .children(
                        GenericTemplates.heading(3, "Headers"),
                        compute(h => GenericTemplates.keyValueInput(h, newHeaders => {
                            headers.value = newHeaders;
                            SettingsTemplates.saveMcpServer(server, name, url, headers);
                        }), headers),
                    ).build(),
            ).build();
    }

    private static mcpServerSaveButton(name: Signal<string>, url: Signal<string>, server: McpServerConfig, headers: Signal<Record<string, string>>) {
        return button({
            icon: {icon: "save"},
            text: "Update server",
            disabled: compute((n, u, h) => (!n || n.length === 0 || !u || u.length === 0)
                && (n === server.name) && (u === server.url)
                && (JSON.stringify(h) === JSON.stringify(server.headers)), name, url, headers),
            classes: ["flex", "align-center", "positive"],
            onclick: () => SettingsTemplates.saveMcpServer(server, name, url, headers)
        });
    }

    private static saveMcpServer(server: McpServerConfig, name: Signal<string>, url: Signal<string>, headers: Signal<Record<string, string>>) {
        const newServers = mcpConfig.value.map(s => {
            if (s.url === server.url) {
                server.name = name.value;
                server.url = url.value;
                server.headers = headers.value ?? {};
            }
            return server;
        });
        Api.setMcpConfig(newServers).then(() => {
            Api.getMcpConfig().then(mcpConf => {
                if (mcpConf.data) {
                    mcpConfig.value = mcpConf.data as McpServerConfig[];
                    toast("MCP config updated", null, ToastType.positive);
                }
            });
        });
    }

    static shortcuts() {
        return create("div")
            .classes("flex-v")
            .children(
                GenericTemplates.heading(2, "Shortcuts"),
                compute(sc => SettingsTemplates.shortcutsInternal(sc), shortCutConfig),
            ).build();
    }

    private static plus(){
        return create("span")
            .text("+")
            .build()
    }

    private static shortcutsInternal(sc: ShortcutConfiguration) {
        return create("div")
            .classes("flex-v")
            .children(
                ...Object.keys(sc).map(action => {
                    const key = signal<string[]>(sc[action]);
                    const unchanged = compute((k, current) => k === current[action], key, shortCutConfig);

                    return create("div")
                        .classes("flex", "card", "align-center")
                        .children(
                            create("b")
                                .text(shortcutNames[action])
                                .build(),
                            GenericTemplates.pill("CTRL"),
                            SettingsTemplates.plus(),
                            GenericTemplates.pill("SHIFT"),
                            SettingsTemplates.plus(),
                            input({
                                type: InputType.text,
                                value: key,
                                name: action,
                                placeholder: action,
                                onchange: (value) => {
                                    key.value = value;
                                }
                            }),
                            button({
                                icon: {
                                    icon: "save",
                                },
                                text: "Set",
                                disabled: unchanged,
                                classes: ["flex", "align-center"],
                                onclick: async () => {
                                    await Api.setShortcutConfig(sc);
                                    shortCutConfig.value = {
                                        ...shortCutConfig.value,
                                        [action]: key.value
                                    };
                                    toast("Shortcuts updated", null, ToastType.positive);
                                }
                            })
                        ).build();
                })
            ).build();
    }
}
