import {Application} from "express";
import {addConfigEndpoints} from "./configuration";
import {addChatEndpoints} from "./ai/endpoints";
import {addMcpEndpoints} from "./ai/tools/endpoints";
import {addAudioEndpoints} from "./ai/tts/endpoints";
import {addShortcutEndpoints} from "./shortcuts/shortcuts";
import {addUserEndpoints} from "./authentication/middleware.ts";

export function createEndpoints(app: Application) {
    addConfigEndpoints(app);
    addChatEndpoints(app);
    addMcpEndpoints(app);
    addAudioEndpoints(app);
    addShortcutEndpoints(app);
    addUserEndpoints(app);
}
