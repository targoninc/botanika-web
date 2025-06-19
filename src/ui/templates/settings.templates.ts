import {GenericTemplates} from "./generic.templates";
import {SettingConfiguration} from "../../models-shared/configuration/SettingConfiguration.ts";
import {createModal, toast} from "../utility/ui";
import {ShortcutConfiguration} from "../../models-shared/shortcuts/ShortcutConfiguration";
import {shortcutNames} from "../../models-shared/shortcuts/Shortcut";
import {McpServerConfig} from "../../models-shared/mcp/McpServerConfig";
import {Configuration} from "../../models-shared/configuration/Configuration.ts";
import {featureOptions, featureTypeIsUsable} from "../../models-shared/configuration/FeatureOptions.ts";
import {compute, create, InputType, nullElement, Signal, signal, signalMap, when} from "@targoninc/jess";
import {button, input} from "@targoninc/jess-components";
import {BotanikaFeature} from "../../models-shared/configuration/BotanikaFeature.ts";
import {ToastType} from "../enums/ToastType.ts";
import {activePage, configuration, mcpConfig, shortCutConfig} from "../utility/state/store.ts";
import {Api} from "../utility/state/api.ts";
import {v4} from "uuid";
import {transcriptionSettings, generalSettings, speechSettings} from "../enums/settings.ts";
import {Tab} from "../models/Tab.ts";
import {FeatureSettings} from "../../models-shared/configuration/FeatureSettings.ts";
import {FeatureType} from "../../models-shared/configuration/FeatureType.ts";

export class SettingsTemplates {
    static settings() {
        const loading = signal(false);
        const tabs = signal<Tab[]>([
            {
                name: "Configuration",
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
        ]);
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
                            SettingsTemplates.generalSettings(loading),
                            SettingsTemplates.configuredFeatures(),
                            SettingsTemplates.mcpConfig(),
                        ], tabs, activeTab),
                        GenericTemplates.spacer()
                    ).build()
            ).build();
    }

    private static generalSettings(loading: Signal<boolean>) {
        return create("div")
            .classes("flex-v")
            .children(
                SettingsTemplates.settingsSection("General", generalSettings, loading),
                SettingsTemplates.settingsSection("Transcription", transcriptionSettings, loading),
                SettingsTemplates.settingsSection("Speech", speechSettings, loading),
                SettingsTemplates.shortcuts()
            ).build();
    }

    private static settingsSection(name: string, settings: SettingConfiguration[], loading: Signal<boolean>) {
        return create("div")
            .classes("flex-v", "card")
            .children(
                GenericTemplates.heading(2, name),
                ...settings.map(s => SettingsTemplates.setting(s, loading, c => c[s.key], (c, k, v) => ({
                    ...c,
                    [k]: v
                }))),
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
                create("div")
                    .classes("flex", "small-gap")
                    .children(
                        GenericTemplates.warning("All data will be saved in this instance's database. Learn how to host your own instance: "),
                        GenericTemplates.buttonWithIcon("open_in_new", "GitHub Repository", () => window.open("https://github.com/targoninc/botanika-web", "_blank")),
                    ).build(),
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
        const featureNotConfigured = compute(c => sc.needsFeatureType ? !featureTypeIsUsable(c, sc.needsFeatureType) : false, configuration);

        return create("div")
            .classes("flex-v", "small-gap", "setting")
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
                when(featureNotConfigured, GenericTemplates.warning(`Feature ${(sc.needsFeatureType ?? "")} is not configured. Head to "Keys" to set up.`)),
                when(sc.description, create("span")
                    .classes("text-small")
                    .text(sc.description)
                    .build()),
                when(sc.descriptionContent, create("div")
                    .classes("flex-v")
                    .children(...(sc.descriptionContent ?? []))
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
                return GenericTemplates.select(sc.label, (sc.options ?? []).map(o => ({
                    text: o,
                    value: o
                })), value, (newValue) => updateKey(sc.key, newValue));
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
        const providers = Object.keys(featureOptions).sort((a, b) => a.localeCompare(b)) as BotanikaFeature[];
        const filters = signal<FeatureType[]>([]);
        const filteredProviders = compute(f => {
            if (f.length === 0) {
                return providers;
            }

            return providers.filter(p => f.every(feat => featureOptions[p]?.features.some(ff => ff.featureType === feat)));
        }, filters);

        return create("div")
            .classes("flex-v")
            .children(
                GenericTemplates.filter(Object.values(FeatureType), filters),
                signalMap(filteredProviders, create("div").classes("flex-v"), f => SettingsTemplates.featureProvider(f, config))
            ).build();
    }

    private static featureProvider(api: BotanikaFeature, config: Configuration) {
        const loading = signal(false);
        const featureConfig = (config.featureOptions ?? {})[api] as Record<string, any> ?? {};
        const provider = featureOptions[api];
        const configuredFeatures = provider.features.filter(f => f.required.every(requiredKey => !!featureConfig[requiredKey]));

        const settingsList = provider && provider.keys.length > 0 ? provider.keys.map(s => SettingsTemplates.setting(s, loading, c => {
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
            .classes("flex-v", "card", "small-gap")
            .children(
                create("div")
                    .classes("flex")
                    .children(
                        // TODO: Add logos
                        create("b")
                            .text(api),
                        SettingsTemplates.providerFeatures(configuredFeatures, provider.features),
                        when(loading, GenericTemplates.spinner())
                    ).build(),
                ...settingsList,
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
                        create("div")
                            .classes("full-width")
                            .children(
                                input({
                                    type: InputType.text,
                                    value: url,
                                    name: "url",
                                    label: "URL",
                                    placeholder: "URL",
                                    classes: ["full-width"],
                                    onchange: (value) => url.value = value
                                })
                            ).build()
                    ).build(),
                button({
                    text: "Add",
                    disabled: compute((n, u) => n.length === 0 || u.length === 0, name, url),
                    icon: {
                        icon: "add",
                    },
                    classes: ["flex", "align-center", "positive"],
                    onclick: () => {
                        const newServers = [...(mcpConfig.value ?? []), <McpServerConfig>{
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
            .classes("flex-v", "card")
            .children(
                GenericTemplates.heading(2, "Shortcuts"),
                compute(sc => SettingsTemplates.shortcutsInternal(sc), shortCutConfig),
            ).build();
    }

    private static plus() {
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
                        .classes("flex", "setting", "align-center")
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
                            when(unchanged, button({
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
                                    toast("Shortcut updated", null, ToastType.positive);
                                }
                            }), true)
                        ).build();
                })
            ).build();
    }

    private static providerFeatures(configuredFeatures: FeatureSettings[], availableFeatures: FeatureSettings[]) {
        return create("div")
            .classes("flex")
            .children(
                ...availableFeatures.map(f => {
                    return SettingsTemplates.availableFeature(f, configuredFeatures.some(feat => feat.featureType === f.featureType));
                })
            ).build();
    }

    private static availableFeature(f: FeatureSettings, isConfigured: boolean) {
        return create("div")
            .classes("feature", isConfigured ? "positive" : "negative")
            .children(
                create("span")
                    .text(f.featureType)
                    .build()
            ).build();
    }
}
