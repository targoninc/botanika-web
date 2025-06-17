import {LayoutTemplates} from "./templates/layout.templates";
import {Realtime} from "./utility/realtime/realtime.ts";
import {activePage, initializeStore} from "./utility/state/store.ts";
import {addShortCutListener} from "./utility/shortCutActions.ts";

initializeStore();

const content = document.getElementById('content');
const app = LayoutTemplates.app(activePage);
content.appendChild(app);

addShortCutListener();
export const realtime = Realtime.getInstance();

window.addEventListener('beforeunload', () => {
    realtime.close();
});

export function focusChatInput() {
    (document.querySelector(".chat-input-field") as HTMLInputElement)?.focus()
}

setTimeout(focusChatInput);