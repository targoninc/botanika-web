import {LayoutTemplates} from "./templates/layout.templates";
import {activePage, initializeStore} from "./classes/store";
import {addShortCutListener} from "./classes/shortcuts/shortcuts";
import {Realtime} from "./classes/realtime/realtime.ts";

initializeStore();

const content = document.getElementById('content');
const app = LayoutTemplates.app(activePage);
content.appendChild(app);

addShortCutListener();
export const realtime = Realtime.getInstance();
