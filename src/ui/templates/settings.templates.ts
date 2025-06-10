import {GenericTemplates} from "./generic.templates";
import {Api} from "../classes/api";
import {activePage, configuration, mcpConfig, shortCutConfig} from "../classes/store";
import {SettingConfiguration} from "../../models/uiExtensions/SettingConfiguration";
import {McpConfiguration} from "../../models/mcp/McpConfiguration";
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
                key: "enableTts",
                icon: "text_to_speech",
                label: "Enable TTS",
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
                key: "transcriptionModel",
                icon: "transcribe",
                label: "Transcription Model",
                description: "Which OpenAI transcription model to use.",
                type: "string",
                validator: value => {
                    const modelOptions = ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper"];
                    return modelOptions.includes(value) || value === '' ? [] : [`Not a valid model, must be one of ${modelOptions.join(",")}`];
                }
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

        return create("div")
            .classes("flex-v", "bordered-panel", "overflow")
            .children(
                create("div")
                    .classes("flex-v", "restrict-width")
                    .children(
                        GenericTemplates.buttonWithIcon("chevron_left", "Back to chat", async () => {
                            activePage.value = "chat";
                        }, ["fixed"]),
                        create("h1")
                            .classes("flex")
                            .styles("margin-top", "2em")
                            .children(
                                create("span")
                                    .text("Settings")
                                    .build(),
                                when(loading, GenericTemplates.spinner()),
                            ).build(),
                        create("div")
                            .classes("flex-v")
                            .children(
                                GenericTemplates.buttonWithIcon("logout", "Log out", async () => {
                                    window.location.href = "/logout";
                                }, ["negative"]),
                            ).build(),
                        GenericTemplates.heading(2, "General"),
                        ...settings.map(s => SettingsTemplates.setting(s, loading, c => c[s.key], (c, k, v) => ({
                            ...c,
                            [k]: v
                        }))),
                        SettingsTemplates.shortcuts(),
                        SettingsTemplates.configuredFeatures(),
                        when(mcpConfig, SettingsTemplates.mcpConfig()),
                        GenericTemplates.spacer()
                    ).build()
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
        const changed = compute((v, c) => v !== (getter(c) ?? null), value, configuration);

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
                        SettingsTemplates.settingImplementation(sc, value, (_, val) => value.value = val),
                        when(changed, button({
                            icon: {icon: "save"},
                            text: "Set",
                            classes: ["flex", "align-center"],
                            onclick: () => updateKey(sc.key, value.value)
                        })),
                    ).build(),
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
            case "password":
                return GenericTemplates.input(InputType.password, sc.key, value, sc.label, sc.label, sc.key, [], (newValue) => updateKey(sc.key, newValue));
            case "color":
                return GenericTemplates.input(InputType.color, sc.key, value, sc.label, sc.label, sc.key, [], (newValue) => updateKey(sc.key, newValue));
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
                        .classes("flex-v", "card")
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
                compute(c => SettingsTemplates.mcpConfigInternal(c ?? <McpConfiguration>{}), mcpConfig)
            ).build();
    }

    static mcpConfigInternal(c: McpConfiguration) {
        return create("div")
            .classes("flex-v")
            .children(
                GenericTemplates.heading(2, "Configured MCP servers"),
                create("div")
                    .classes("card")
                    .children(
                        GenericTemplates.warning("You might have to restart the application after changing MCP server configuration")
                    ).build(),
                ...Object.keys(c?.servers ?? {}).map(server => {
                    return SettingsTemplates.existingMcpServer(c.servers[server]);
                }),
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
                    classes: ["flex", "align-center"],
                    onclick: () => {
                        Api.addMcpServer(url.value, name.value).then(() => {
                            Api.getMcpConfig().then(mcpConf => {
                                if (mcpConf.data) {
                                    mcpConfig.value = mcpConf.data as McpConfiguration;
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
        const oldUrl = server.url;

        return create("div")
            .classes("flex-v", "bordered-panel")
            .children(
                create("div")
                    .classes("flex", "align-center", "space-between")
                    .children(
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
                                }),
                                button({
                                    icon: {icon: "save"},
                                    text: "Set",
                                    disabled: compute((n, u) => !n || n.length === 0 || !u || u.length === 0, name, url),
                                    classes: ["flex", "align-center"],
                                    onclick: () => {
                                        createModal(GenericTemplates.confirmModalWithContent("Change MCP server config", create("div")
                                            .children(
                                                create("p")
                                                    .text(`Are you sure you want to change the config for MCP server ${server.name}?`),
                                            ).build(), "Yes", "No", () => {
                                            server.name = name.value;
                                            server.url = url.value;
                                            Api.updateMcpServer(oldUrl, server).then(() => {
                                                Api.getMcpConfig().then(mcpConf => {
                                                    if (mcpConf.data) {
                                                        mcpConfig.value = mcpConf.data as McpConfiguration;
                                                        toast("MCP config updated", null, ToastType.positive);
                                                    }
                                                });
                                            });
                                        }));
                                    }
                                })
                            ).build(),
                        GenericTemplates.buttonWithIcon("delete", "Delete", () => {
                            createModal(GenericTemplates.confirmModal("Delete MCP Server connection", `Are you sure you want to delete ${server.url}?`, "Yes", "No", () => {
                                Api.deleteMcpServer(server.url).then(() => {
                                    Api.getMcpConfig().then(mcpConf => {
                                        if (mcpConf.data) {
                                            mcpConfig.value = mcpConf.data as McpConfiguration;
                                        }
                                    });
                                });
                            }));
                        }, ["negative"]),
                    ).build(),
                create("div")
                    .classes("flex-v")
                    .children(
                        GenericTemplates.heading(3, "Headers"),
                        GenericTemplates.keyValueInput(server.headers, headers => {
                            server.headers = headers;
                            Api.updateMcpServer(oldUrl, server).then(() => {
                                toast("MCP server updated");
                                Api.getMcpConfig().then(mcpConf => {
                                    if (mcpConf.data) {
                                        mcpConfig.value = mcpConf.data as McpConfiguration;
                                    }
                                });
                            });
                        })
                    ).build(),
            ).build();
    }

    static shortcuts() {
        return create("div")
            .classes("flex-v")
            .children(
                GenericTemplates.heading(2, "Shortcuts"),
                compute(sc => SettingsTemplates.shortcutsInternal(sc), shortCutConfig),
            ).build();
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
                            GenericTemplates.hotkey("SHIFT", true),
                            create("span")
                                .text("+")
                                .build(),
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
