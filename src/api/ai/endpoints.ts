import {Application, Request, Response} from "express";
import {ChatMessage} from "../../models/chat/ChatMessage";
import {initializeLlms} from "./llms/models";
import {ApiEndpoint} from "../../models/ApiEndpoints";
import {ChatContext} from "../../models/chat/ChatContext";
import {ChatStorage} from "../storage/ChatStorage";
import {getTtsAudio} from "./tts/tts";
import {AudioStorage} from "../storage/AudioStorage";
import {signal} from "@targoninc/jess";
import {sendChatUpdate, WebsocketConnection} from "../../ui-server/websocket-server/websocket.ts";
import {ChatStorageNew} from "../storage/ChatStorageNew.ts";

export const currentChatContext = signal<ChatContext>(null);

export async function getAudio(lastMessage: ChatMessage): Promise<string> {
    if (lastMessage.type === "assistant") {
        const blob = await getTtsAudio(lastMessage.text);
        await AudioStorage.writeAudio(lastMessage.id, blob);
        return AudioStorage.getLocalFileUrl(lastMessage.id);
    }

    return null;
}

export async function sendAudioAndStop(ws: WebsocketConnection, chatId: string, lastMessage: ChatMessage) {
    const audioUrl = await getAudio(lastMessage);
    if (audioUrl) {
        sendChatUpdate(ws, {
            chatId,
            timestamp: Date.now(),
            messages: [
                {
                    ...lastMessage,
                    hasAudio: true
                }
            ]
        })
    }
}

export async function getChatIdsEndpoint(req: Request, res: Response) {
    const chats = await ChatStorageNew.getUserChats(req.user.id);
    res.send(chats);
}

export function getChatEndpoint(req: Request, res: Response) {
    const chatId = req.params.chatId;
    if (!chatId) {
        res.status(400).send('Missing chatId parameter');
        return;
    }

    ChatStorageNew.readChatContext(req.user.id, chatId).then(chatContext => {
        if (!chatContext) {
            res.status(404).send('Chat not found');
            return;
        }
        res.send(chatContext);
    });
}

export function deleteChatEndpoint(req: Request, res: Response) {
    const chatId = req.params.chatId;
    if (!chatId) {
        res.status(400).send('Missing chatId parameter');
        return;
    }

    ChatStorageNew.deleteChatContext(req.user.id, chatId).then(() => {
        res.status(200).send('Chat deleted');
    });
}

let models = {};

export async function getModelsEndpoint(req: Request, res: Response) {
    if (Object.keys(models).length === 0) {
        models = await initializeLlms();
    }
    res.status(200).send(models);
}

export async function deleteAfterMessageEndpoint(req: Request, res: Response) {
    const chatId = req.body.chatId;
    const messageId = req.body.messageId;
    if (!chatId || !messageId) {
        res.status(400).send('Missing chatId or messageId parameter');
    }

    ChatStorage.readChatContext(chatId).then(async c => {
        const messageIndex = c.history.map(m => m.id).indexOf(messageId);
        c.history.splice(messageIndex);
        await ChatStorage.writeChatContext(chatId, c);
        res.status(200).send();
    });
}

export function addChatEndpoints(app: Application) {
    app.get(`${ApiEndpoint.CHAT_BY_ID}:chatId`, getChatEndpoint);
    app.get(ApiEndpoint.CHATS, getChatIdsEndpoint);
    app.delete(`${ApiEndpoint.CHAT_BY_ID}:chatId`, deleteChatEndpoint);
    app.post(ApiEndpoint.DELETE_AFTER_MESSAGE, deleteAfterMessageEndpoint);
    app.get(ApiEndpoint.MODELS, getModelsEndpoint);
}
