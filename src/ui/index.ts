import {LayoutTemplates} from "./templates/layout.templates";
import {addShortCutListener} from "./classes/shortcuts/shortcuts";
import {Realtime} from "./classes/realtime/realtime.ts";
import {activePage, initializeStore} from "./classes/state/store.ts";

initializeStore();

const content = document.getElementById('content');
const app = LayoutTemplates.app(activePage);
content.appendChild(app);

addShortCutListener();
export const realtime = Realtime.getInstance();
