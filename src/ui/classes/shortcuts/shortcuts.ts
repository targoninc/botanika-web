import {shortCutConfig, target} from "../state/store";
import {shortCutActions} from "./shortCutActions";
import {closeModal} from "../ui";

export function addShortCutListener() {
    const blockShortcuts = ["INPUT", "TEXTAREA", "SELECT"];
    document.addEventListener("keydown", (e) => {
        const shortcutConfig = shortCutConfig.value;
        for (const [action, func] of Object.entries(shortCutActions)) {
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