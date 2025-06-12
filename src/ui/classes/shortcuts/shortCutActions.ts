import {Shortcut} from "../../../models/shortcuts/Shortcut";
import {activePage, currentChatId} from "../state/store.ts";

export const shortCutActions: Record<Shortcut, () => void> = {
    [Shortcut.newChat]: () => {
        currentChatId.value = null;
    },
    [Shortcut.settings]: () => {
        activePage.value = "settings";
    },
    [Shortcut.focusInput]: () => {
        const area = document.getElementById("chat-input-field");
        area?.focus();
    }
}
