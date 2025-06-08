import {GenericTemplates} from "./generic.templates";
import {pages} from "../enums/pages";
import {SettingsTemplates} from "./settings.templates";
import {ChatTemplates} from "./chat.templates";
import {AnyNode, create, signal, Signal} from "@targoninc/jess";

export class LayoutTemplates {
    static app(activePage: Signal<string>) {
        const tabs = [
            ChatTemplates.chat(),
            SettingsTemplates.settings(),
        ];

        return create("div")
            .classes("app", "no-wrap", "padded-big", "flex-v")
            .children(
                GenericTemplates.tabs(tabs, signal(pages), activePage),
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