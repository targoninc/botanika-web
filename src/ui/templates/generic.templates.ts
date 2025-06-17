import {closeModal, createModal, toast} from "../classes/ui";
import {Callback, configuration, currentUser, target} from "../classes/state/store";
import {ToastType} from "../enums/ToastType";
import {
    AnyElement,
    AnyNode,
    compute,
    create,
    InputType,
    signal,
    Signal, signalMap,
    StringOrSignal,
    TypeOrSignal,
    when
} from "@targoninc/jess";
import {button, icon, input, textarea, toggle} from "@targoninc/jess-components";
import {MessageFile} from "../../models-shared/chat/MessageFile.ts";
import {toHumanizedTime} from "../classes/toHumanizedTime.ts";
import {Api} from "../classes/state/api.ts";
import {TextSegment} from "../models/TextSegment.ts";
import {Tab} from "../models/Tab.ts";

export class GenericTemplates {
    static input<T>(type: InputType, name: StringOrSignal, value: any, placeholder: StringOrSignal, label: StringOrSignal, id: any, classes: StringOrSignal[] = [],
                    onchange: Callback<[T]> = () => {
                    }, attributes: StringOrSignal[] = [], required = false) {
        return input<T>({
            type,
            name,
            value,
            placeholder,
            label,
            id,
            classes,
            onchange,
            attributes,
            required
        });
    }

    static iconButton(icon: StringOrSignal, text: StringOrSignal, onclick: (e: any) => void) {
        return button({
            icon: { icon },
            classes: ["flex", "align-center", "icon-button"],
            title: text,
            onclick
        });
    }

    static segmentedText(segments: TextSegment[]) {
        return create("span")
            .classes("segmented-text")
            .children(
                ...segments.map(segment => {
                    return create("span")
                        .classes(segment.type)
                        .text(segment.text)
                        .build();
                })
            ).build();
    }

    static icon(icon: StringOrSignal, classes: StringOrSignal[] = [], title = "", tag = "span") {
        if (icon && (icon.constructor === String && (icon.includes(".") || icon.startsWith("data:image"))) || (icon.constructor === Signal && icon.value &&
            (icon.value.includes(".") || icon.value.startsWith("data:image")))) {
            return create("img")
                .classes("icon", ...classes)
                .src(icon)
                .title(title)
                .build();
        }

        return create(tag)
            .classes("material-symbols-outlined", ...classes)
            .text(icon)
            .title(title)
            .build();
    }

    static heading(level: number, text: StringOrSignal) {
        return create(`h${level}`)
            .text(text)
            .build();
    }

    static buttonWithIcon(icon: StringOrSignal, text: StringOrSignal, onclick: Callback<[]>, classes: StringOrSignal[] = [], iconClasses: StringOrSignal[] = [], hotkey: StringOrSignal = null) {
        return create("button")
            .classes("flex", ...classes)
            .onclick(onclick)
            .children(
                GenericTemplates.icon(icon, iconClasses.concat("no-pointer-events")),
                when(text, create("span")
                    .classes("no-pointer-events")
                    .text(text)
                    .build()),
                GenericTemplates.hotkey(hotkey),
            ).build();
    }

    static verticalButtonWithIcon(icon: StringOrSignal, text: StringOrSignal, onclick: Callback<[]>, classes: StringOrSignal[] = [], iconClasses: StringOrSignal[] = [], hotkey: StringOrSignal = null) {
        return create("button")
            .classes("flex-v", "align-center", "small-gap", ...classes)
            .onclick(onclick)
            .children(
                GenericTemplates.icon(icon, iconClasses),
                when(text, create("span")
                    .text(text)
                    .build()),
                GenericTemplates.hotkey(hotkey),
            ).build();
    }

    static hotkey(hotkey: StringOrSignal, alwaysDisplay = false) {
        const show = compute(c => alwaysDisplay || (c.display_hotkeys === true && hotkey != null), configuration);

        return when(show, GenericTemplates.pill(hotkey)) as AnyElement;
    }

    static pill(pillText: StringOrSignal) {
        return create("kbd")
            .classes("hotkey")
            .text(pillText)
            .build();
    }

    static spinner(circleCount = 4, delay = 0.2) {
        return create("div")
            .classes("spinner")
            .children(
                ...Array.from({length: circleCount}, (_, i) => {
                    return create("div")
                        .classes("spinner-circle")
                        .styles("animation-delay", `-${i * delay}s`)
                        .build();
                })
            ).build();
    }

    static select(label: StringOrSignal | null, options: Array<{
        text: string;
        value: any;
    }>, value: any, onchange: (value: any) => void) {
        return create("div")
            .classes("flex", "align-center")
            .children(
                when(label, create("span")
                    .text(label)
                    .build()),
                create("div")
                    .classes("select")
                    .children(
                        create("select")
                            .onchange((e) => {
                                onchange(target(e).value);
                            })
                            .children(
                                ...options.map(option => {
                                    const selected = compute(value => option.value === value, value);

                                    return create("option")
                                        .text(option.text)
                                        .value(option.value)
                                        .selected(selected)
                                        .onclick(() => {
                                            onchange(option.value);
                                        }).build();
                                })
                            ).build()
                    ).build()
            ).build();
    }

    static copyButton(buttonText: StringOrSignal, text: StringOrSignal) {
        return GenericTemplates.buttonWithIcon("content_copy", buttonText, async () => {
            if (text.constructor === String) {
                text = signal(text);
            }
            await navigator.clipboard.writeText((text as Signal<string>).value);
            toast("ID copied to clipboard", null, ToastType.positive);
        })
    }

    static confirmModal(title: StringOrSignal, message: StringOrSignal, confirmText = "Confirm", cancelText = "Cancel",
                        confirmCallback = () => {
                        }, cancelCallback = () => {
        }) {
        return create("div")
            .classes("flex-v")
            .children(
                create("h1")
                    .text(title)
                    .build(),
                create("p")
                    .text(message)
                    .build(),
                create("div")
                    .classes("flex")
                    .children(
                        GenericTemplates.buttonWithIcon("check_circle", confirmText, () => {
                            confirmCallback();
                            closeModal();
                        }, ["positive"]),
                        GenericTemplates.buttonWithIcon("close", cancelText, () => {
                            cancelCallback();
                            closeModal();
                        }, ["negative"])
                    ).build()
            ).build();
    }

    static confirmModalWithContent(title: StringOrSignal, content: AnyNode, confirmText = "Confirm", cancelText = "Cancel",
                                   confirmCallback = () => {
                                   }, cancelCallback = () => {
        }) {
        return create("div")
            .classes("flex-v")
            .children(
                create("h1")
                    .text(title)
                    .build(),
                content,
                create("div")
                    .classes("flex")
                    .children(
                        GenericTemplates.buttonWithIcon("check_circle", confirmText, () => {
                            confirmCallback();
                            closeModal();
                        }, ["positive"]),
                        GenericTemplates.buttonWithIcon("close", cancelText, () => {
                            cancelCallback();
                            closeModal();
                        }, ["negative"])
                    ).build()
            ).build();
    }

    static textArea(value: any, label: StringOrSignal, id: StringOrSignal, oninput: Callback<[string]>) {
        return textarea({
            classes: ["full-width"],
            name: "textarea",
            value,
            label,
            id,
            onchange: oninput
        });
    }

    static toggle(text: StringOrSignal, checked: TypeOrSignal<boolean> = false, callback: Callback<[boolean]> = () => {
    }, extraClasses: StringOrSignal[] = [], id: StringOrSignal = null) {
        return toggle({
            classes: [...extraClasses],
            text,
            checked,
            id,
            onchange: callback,
        });
    }

    static tabs(tabs: Array<AnyElement>, tabDefs: Signal<Tab[]>, activeTab: Signal<string>) {
        const tabButtons = signalMap(tabDefs, create("div").classes("flex", "align-center", "no-gap"), (tabDef: Tab) => {
            const active = compute(activeTab => activeTab === tabDef.id, activeTab);

            return GenericTemplates.tabButton(tabDef, active, () => activeTab.value = tabDef.id);
        });

        return create("div")
            .classes("flex-v", "flex-grow", "small-gap")
            .children(
                tabButtons,
                ...tabs.map((tab, i) => {
                    const tabDef = tabDefs.value[i];
                    const active = compute(activeTab => activeTab === tabDef.id, activeTab);

                    return when(active, tab);
                })
            ).build();
    }

    static tabButton(tab: Tab, active: Signal<boolean>, onClick: Callback<[]>, classes: StringOrSignal[] = []) {
        const activeClass = compute((active): string => active ? "active" : "_", active);

        return create("div")
            .classes("flex", "align-center", "tab-button", activeClass, ...classes)
            .onclick(onClick)
            .children(
                when(tab.icon, GenericTemplates.icon(tab.icon)),
                create("span")
                    .text(tab.name)
                    .build(),
                when(tab.hotkey, GenericTemplates.hotkey(tab.hotkey)),
            ).build();
    }

    static warning(warning: StringOrSignal) {
        return create("div")
            .classes("warning", "flex", "align-center", "text-small")
            .children(
                GenericTemplates.icon("warning"),
                create("span")
                    .text(warning)
                    .build()
            ).build();
    }

    static errorIndicator(errorCount: StringOrSignal) {
        return create("div")
            .classes("error-indicator")
            .text(errorCount)
            .build();
    }

    static properties(data: any) {
        if (Object.keys(data).length === 0) {
            return create("td")
                .classes("log-properties")
                .build();
        }
        const shown = signal(false);

        return create("td")
            .classes("flex-v")
            .styles("position", "relative")
            .children(
                button({
                    text: "Info",
                    icon: {icon: "info"},
                    onclick: () => {
                        shown.value = !shown.value;
                    }
                }),
                when(shown, create("div")
                    .classes("flex-v", "card", "popout-below", "log-properties")
                    .children(
                        ...Object.keys(data).map(k => {
                            return GenericTemplates.property(k, data[k]);
                        })
                    ).build()),
            ).build();
    }

    static property(key: string, value: any): AnyElement {
        if (value === null) {
            value = "null";
        }

        let valueChild, showKey = true;
        if (typeof value !== "object") {
            valueChild = create("span")
                .classes("property-value")
                .text(value)
                .build();
        } else {
            showKey = false;
            valueChild = create("details")
                .children(
                    create("summary")
                        .classes("property-value")
                        .text(key)
                        .build(),
                    create("div")
                        .classes("property-value", "flex-v")
                        .children(
                            ...Object.keys(value).map((k: string) => {
                                return GenericTemplates.property(k, value[k]) as any;
                            })
                        ).build()
                ).build();
        }

        return create("div")
            .classes("property", "flex")
            .children(
                showKey ? create("span")
                    .classes("property-key")
                    .text(key)
                    .build() : null,
                valueChild
            ).build();
    }

    static codeCopyButton(content: string) {
        return create("div")
            .classes("parent-top-left", "flex", "code-copy-button")
            .children(
                GenericTemplates.iconButton("content_copy", "Copy to clipboard", () => {
                    navigator.clipboard.writeText(content);
                    toast("Copied to clipboard");
                }),
            ).build();
    }

    static keyValueInput(headers: Record<string, string> = {}, onChange: (value: Record<string, string>) => void) {
        return create("div")
            .classes("flex-v")
            .children(
                create("div")
                    .classes("flex-v")
                    .children(
                        ...Object.keys(headers).map(key => {
                            const key$ = signal(key);
                            const val$ = signal(headers[key]);

                            return create("div")
                                .classes("flex", "align-center")
                                .children(
                                    input({
                                        type: InputType.text,
                                        value: key,
                                        name: "key",
                                        placeholder: "Key",
                                        onchange: (newVal) => {
                                            key$.value = newVal;
                                        }
                                    }),
                                    input({
                                        type: InputType.text,
                                        value: val$,
                                        name: key,
                                        placeholder: key,
                                        onchange: (newVal) => {
                                            val$.value = newVal;
                                        }
                                    }),
                                    button({
                                        icon: {icon: "save"},
                                        text: "Update",
                                        disabled: compute((nk, nv) => !nk || !nv || nk.length === 0 || nv.length === 0 || (nv === headers[key] && nk === key), key$, val$),
                                        classes: ["flex", "align-center", "positive"],
                                        onclick: () => {
                                            delete headers[key];
                                            headers = {
                                                ...headers,
                                                [key$.value]: val$.value
                                            };
                                            onChange(headers);
                                        }
                                    }),
                                    GenericTemplates.buttonWithIcon("delete", "Delete", () => {
                                        createModal(GenericTemplates.confirmModal("Delete header", `Are you sure you want to delete header ${key}?`, "Yes", "No", () => {
                                            delete headers[key];
                                            onChange(headers);
                                            toast("Header deleted", null, ToastType.positive);
                                        }));
                                    }, ["negative"])
                                ).build();
                        })
                    ).build(),
                button({
                    text: "Add header",
                    icon: {
                        icon: "add",
                    },
                    classes: ["flex", "align-center", "positive"],
                    onclick: () => {
                        headers = {
                            ...headers,
                            ["New"]: ""
                        };
                        onChange(headers);
                    }
                })
            ).build();
    }

    static redDot(onState: Signal<boolean>, scaleState: Signal<number>) {
        const classExt = compute(o => o ? "_" : "hidden", onState);
        const transform = compute(s => {
            const inverseLinear = (1 - s);
            const squaredInverse = inverseLinear * inverseLinear * inverseLinear;
            const factor = 1 - squaredInverse;
            const scale = Math.max(.5, Math.min(1.5, .5 + factor));
            return `scale(${scale})`;
        }, scaleState);

        return create("div")
            .classes("red-dot-container")
            .children(
                create("div")
                    .styles("transform", transform)
                    .classes("red-dot", classExt)
                    .build()
            ).build();
    }

    static user() {
        const image = compute(u => u?.picture ?? ".", currentUser);

        return create("div")
            .classes("flex-v", "align-children")
            .children(
                GenericTemplates.icon(image, ["user-image"]),
                create("span")
                    .text(compute(u => u?.nickname ?? u?.name ?? "Not logged in", currentUser))
                    .build(),
                create("span")
                    .classes("monospace")
                    .text(compute(u => u?.externalId.split("|")[0], currentUser))
                    .build(),
                create("div")
                    .classes("flex-v", "small-gap")
                    .children(
                        create("span")
                            .text("Account created:")
                            .build(),
                        create("span")
                            .classes("text-small")
                            .text(compute(u => toHumanizedTime(new Date(u?.createdAt ?? Date.now()).getTime()).value, currentUser))
                            .build(),
                    ).build()
            ).build();
    }

    static spacer() {
        return create("div")
            .classes("spacer")
            .build();
    }

    static userPopup() {
        return create("div")
            .classes("flex-v", "flyout", "below", "left")
            .children(
                GenericTemplates.user(),
                GenericTemplates.buttonWithIcon("logout", "Log out", async () => {
                    localStorage.clear();
                    window.location.href = "/logout";
                }, ["negative"]),
                GenericTemplates.buttonWithIcon("delete", "Delete account", async () => {
                    createModal(GenericTemplates.confirmModal("Delete account", "Are you sure you want to delete your account? This action cannot be undone.", "DELETE ACCOUNT", "Cancel", () => {
                        Api.deleteUser().then(r => {
                            if (r.success) {
                                localStorage.clear();
                                window.location.href = "/logout";
                            }
                        });
                    }))
                }, ["negative"]),
            ).build();
    }

    static userIcon(userPopupVisible: Signal<boolean>) {
        const image = compute(u => u?.picture ?? ".", currentUser);

        return create("div")
            .classes("clickable")
            .onclick(() => {
                userPopupVisible.value = !userPopupVisible.value;
            })
            .children(
                GenericTemplates.icon(image, ["user-image"])
            ).build();
    }

    static messageImage(f: MessageFile) {
        return create("div")
            .classes("relative")
            .children(
                create("img")
                    .classes("file-display-image")
                    .src(`data:${f.mimeType};base64,` + f.base64)
                    .build(),
                create("div")
                    .classes("image-hover", "flex", "full-height", "full-width", "align-center", "center-content", "showOnParentHover")
                    .onclick(() => {
                        createModal(create("img")
                            .classes("modal-image")
                            .src(`data:${f.mimeType};base64,` + f.base64)
                            .build());
                    })
                    .children(
                        icon({
                            icon: "visibility",
                        })
                    ).build()
            ).build();
    }

    static statusIndicator(status: Signal<boolean>) {
        return create("div")
            .classes("status-indicator", compute((s): string => s ? "on" : "off", status))
            .title(compute(s => s ? "Connected to realtime server" : "Offline, trying to reconnect...", status))
            .build();
    }

    static movableDivider(querySelector: string) {
        let startX = 0;
        let startWidth = 0;
        let toResize: HTMLElement | null = null;

        const handleDragStart = (e: MouseEvent) => {
            startX = e.clientX;
            toResize = document.querySelector(querySelector);
            if (!toResize) {
                return;
            }
            startWidth = toResize.clientWidth;

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleDragEnd);

            // Prevent text selection while dragging
            document.body.style.userSelect = 'none';
        };

        const handleDrag = (e: MouseEvent) => {
            if (!toResize) return;

            const deltaX = e.clientX - startX;
            const newWidth = Math.max(200, Math.min(800, startWidth + deltaX));
            localStorage.setItem(`divider-width-${querySelector}`, newWidth.toString());

            toResize.style.width = `${newWidth}px`;
        };

        const handleDragEnd = () => {
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', handleDragEnd);
            document.body.style.userSelect = '';
            toResize = null;
        };

        return create("div")
            .classes("full-height", "movable-divider", "flex", "align-children")
            .onmousedown(handleDragStart)
            .children(
                GenericTemplates.icon("drag_handle", ["rotate90"])
            ).build();
    }

    static link(url: string) {
        return create("a")
            .classes("text-small")
            .text(url)
            .href(url)
            .target("_blank")
            .build();
    }
}
