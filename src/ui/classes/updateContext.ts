import {ChatUpdate} from "../../models/chat/ChatUpdate.ts";
import {ChatContext} from "../../models/chat/ChatContext.ts";
import {ChatMessage} from "../../models/chat/ChatMessage.ts";

export function updateContext(c: ChatContext, update: ChatUpdate) {
    if (c.id && c.id !== update.chatId) {
        return c;
    }

    const updatedContext = structuredClone(c);

    if (!updatedContext.id) {
        updatedContext.id = update.chatId;
    }

    if (updatedContext.name !== update.name && update.name) {
        updatedContext.name = update.name;
        updatedContext.createdAt = Date.now();
    }

    if (updatedContext.shared !== update.shared && update.shared !== undefined) {
        updatedContext.shared = update.shared;
    }

    if (!updatedContext.history) {
        updatedContext.history = [];
    }

    if (update.messages) {
        updatedContext.history = updateMessageHistory(updatedContext.history, update.messages);
    }

    updatedContext.history.sort((a, b) => a.time - b.time);

    return updatedContext;
}

function updateMessageHistory(history: ChatMessage[], newMessages: ChatMessage[]) {
    return newMessages.reduce((updatedHistory, message) => {
        const messageExists = updatedHistory.some(m => m.id === message.id);

        if (messageExists) {
            return updatedHistory.map(m => m.id === message.id ? message : m);
        } else {
            updatedHistory.push(message);
            return updatedHistory;
        }
    }, history);
}
