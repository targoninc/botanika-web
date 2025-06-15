import {ChatUpdate} from "../../models/chat/ChatUpdate.ts";
import {ChatContext} from "../../models/chat/ChatContext.ts";

export function updateContext(c: ChatContext, update: ChatUpdate) {
    if (c.id && c.id !== update.chatId) {
        return c;
    }

    c = structuredClone(c);
    if (!c.id) {
        c.id = update.chatId;
    }

    if (c.name !== update.name && update.name) {
        c.name = update.name;
        c.createdAt = Date.now();
    }

    if (c.shared !== update.shared && update.shared !== undefined) {
        c.shared = update.shared;
    }

    if (!c.history) {
        c.history = [];
    }
    if (update.messages) {
        for (const message of update.messages) {
            const existingMsg = c.history.find(m => m.id === message.id);
            if (existingMsg) {
                c.history = c.history.map(m => {
                    if (m.id === message.id) {
                        return message;
                    }
                    return m;
                });
            } else {
                c.history.push(message);
            }
        }
    }
    c.history = c.history.sort((a, b) => a.time - b.time);
    return c;
}
