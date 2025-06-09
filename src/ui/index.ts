import {LayoutTemplates} from "./templates/layout.templates";
import {activePage, initializeStore} from "./classes/store";
import {addShortCutListener} from "./classes/shortcuts/shortcuts";
import {Realtime} from "./classes/realtime";

initializeStore();

const content = document.getElementById('content');
const app = LayoutTemplates.app(activePage);
content.appendChild(app);

addShortCutListener();
Realtime.getInstance();
