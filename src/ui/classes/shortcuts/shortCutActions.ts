import {Shortcut} from "../../../models/shortcuts/Shortcut";
import {INITIAL_CONTEXT} from "../../../models/chat/initialContext";
import {activePage, chatContext} from "../state/store.ts";

export const shortCutActions: Record<Shortcut, () => void> = {
    [Shortcut.newChat]: () => {
        chatContext.value = INITIAL_CONTEXT;
    },
    [Shortcut.settings]: () => {
        activePage.value = "settings";
    },
    [Shortcut.focusInput]: () => {
        const area = document.getElementById("chat-input-field");
        area?.focus();
    }
}