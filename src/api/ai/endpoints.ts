import {Application, Request, Response} from "express";
import {ChatMessage} from "../../models/chat/ChatMessage";
import {initializeLlms} from "./llms/models";
import {ApiEndpoint} from "../../models/ApiEndpoints";
import {getTtsAudio} from "./tts/tts";
import {AudioStorage} from "../storage/AudioStorage";
import {removeOngoingConversation, sendChatUpdate, WebsocketConnection} from "../websocket-server/websocket.ts";
import {ChatStorage} from "../storage/ChatStorage.ts";
import {v4} from "uuid";

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

export async function getChatsEndpoint(req: Request, res: Response) {
    const from = req.query.from ? new Date(req.query.from as string) : null;

    const chats = await ChatStorage.getUserChats(req.user.id, from);
    res.send(chats);
}

export function getChatEndpoint(req: Request, res: Response) {
    const chatId = req.params.chatId;
    if (!chatId) {
        res.status(400).send('Missing chatId parameter');
        return;
    }

    if (req.query.shared === "true") {
        ChatStorage.readPublicChatContext(chatId).then(chatContext => {
            if (!chatContext) {
                res.status(404).send('Chat not found');
                return;
            }
            res.send(chatContext);
        });
    } else {
        ChatStorage.readChatContext(req.user.id, chatId).then(chatContext => {
            if (!chatContext) {
                res.status(404).send('Chat not found');
                return;
            }
            res.send(chatContext);
        });
    }
    return;
}

export function deleteChatEndpoint(req: Request, res: Response) {
    const chatId = req.params.chatId;
    if (!chatId) {
        res.status(400).send('Missing chatId parameter');
        return;
    }

    removeOngoingConversation(chatId, req.user.id);

    ChatStorage.deleteChatContext(req.user.id, chatId).then(() => {
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

    ChatStorage.readChatContext(req.user.id, chatId).then(async c => {
        const message = c.history.find(m => m.id === messageId);

        if (req.body.exclusive) {
            c.history = c.history.filter(m => m.time < message.time);
        } else {
            c.history = c.history.filter(m => m.time <= message.time);
        }

        await ChatStorage.writeChatContext(req.user.id, c);
        res.status(200).send();
    });
}

function branchChatEndpoint(req: Request, res: Response) {
    const chatId = req.body.chatId;
    const messageId = req.body.messageId;
    if (!chatId || !messageId) {
        res.status(400).send('Missing chatId or messageId parameter');
    }

    ChatStorage.readChatContext(req.user.id, chatId).then(async c => {
        if (!c) {
            res.status(404).send('Chat not found');
        }
        const message = c.history.find(m => m.id === messageId);
        c.branched_from_chat_id = c.id;
        c.id = v4();
        c.createdAt = Date.now();
        c.history = c.history.filter(m => m.time <= message.time);
        c.history = c.history.map(msg => {
            msg.id = v4();
            return msg;
        });
        await ChatStorage.writeChatContext(req.user.id, c);
        res.status(200).json(c);
    });
}

export function addChatEndpoints(app: Application) {
    app.get(`${ApiEndpoint.CHAT_BY_ID}:chatId`, getChatEndpoint);
    app.get(ApiEndpoint.CHATS, getChatsEndpoint);
    app.delete(`${ApiEndpoint.CHAT_BY_ID}:chatId`, deleteChatEndpoint);
    app.post(ApiEndpoint.DELETE_AFTER_MESSAGE, deleteAfterMessageEndpoint);
    app.get(ApiEndpoint.MODELS, getModelsEndpoint);
    app.post(ApiEndpoint.BRANCH_CHAT, branchChatEndpoint);
}
