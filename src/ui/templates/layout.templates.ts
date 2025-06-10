import {GenericTemplates} from "./generic.templates";
import {SettingsTemplates} from "./settings.templates";
import {ChatTemplates} from "./chat.templates";
import {AnyNode, compute, create, Signal, when} from "@targoninc/jess";

export class LayoutTemplates {
    static app(activePage: Signal<string>) {
        return create("div")
            .classes("app", "no-wrap", "padded-big", "flex-v")
            .children(
                when(compute(p => p === "chat", activePage), ChatTemplates.chat()),
                when(compute(p => p === "settings", activePage), SettingsTemplates.settings()),
            ).build();
    }

    static modal(content: AnyNode) {
        const self = create("div")
            .classes("modal")
            .children(
                create("div")
                    .classes("modal-content")
                    .children(
                        content,
                        create("div")
                            .classes("modal-close")
                            .children(
                                GenericTemplates.buttonWithIcon("close", "Close", () => {
                                    self.remove();
                                }),
                            ).build(),
                    ).build(),
            ).build();

        return self;
    }
}