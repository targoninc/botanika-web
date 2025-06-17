import {Application, Request, Response} from "express";
import {initializeLlms} from "./llms/models";
import {ApiEndpoint} from "../../models-shared/ApiEndpoints";
import {removeOngoingConversation} from "../websocket-server/websocket.ts";
import {ChatStorage} from "../storage/ChatStorage.ts";
import {v4} from "uuid";

export async function getChatsEndpoint(req: Request, res: Response) {
    const from = req.query.from ? new Date(req.query.from as string) : null;

    const chats = await ChatStorage.getUserChats(req.user.id, from);
    res.send(chats);
}

export async function getDeletedChatsEndpoint(req: Request, res: Response) {
    const ids = req.body.ids as string[];
    if (!ids) {
        res.status(400).send("Missing ids parameter");
        return;
    }

    const chats = await ChatStorage.getUserChats(req.user.id);
    const chatIds = chats.map((chat) => chat.id);
    const deleted = ids.filter(id => !chatIds.includes(id));

    res.send(deleted);
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

export function getModelsEndpoint(req: Request, res: Response) {
    if (Object.keys(models).length === 0) {
        models = initializeLlms();
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
    app.post(ApiEndpoint.GET_DELETED_CHATS, getDeletedChatsEndpoint);
}
