import {Shortcut} from "../../models-shared/shortcuts/Shortcut.ts";
import {activePage, currentChatId, shortCutConfig, target} from "./state/store.ts";
import {closeModal} from "./ui.ts";

export const shortcuts: Record<Shortcut, () => void> = {
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

export function addShortCutListener() {
    const blockShortcuts = ["INPUT", "TEXTAREA", "SELECT"];
    document.addEventListener("keydown", (e) => {
        const shortcutConfig = shortCutConfig.value;
        for (const [action, func] of Object.entries(shortcuts)) {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === shortcutConfig[action].toLowerCase()) {
                e.preventDefault();
                func();
            }
        }

        if (blockShortcuts.includes(target(e).tagName)) {
            return;
        }

        if (e.key === "Escape") {
            closeModal();
        }
    });
}