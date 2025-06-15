import {Application, Request, Response} from "express";
import {AssistantMessage, ChatMessage} from "../../models/chat/ChatMessage";
import {initializeLlms} from "./llms/models";
import {ApiEndpoint} from "../../models/ApiEndpoints";
import {getTtsAudio} from "./tts/tts";
import {AudioStorage} from "../storage/AudioStorage";
import {WebsocketConnection} from "../websocket-server/websocket.ts";
import {ChatStorage} from "../storage/ChatStorage.ts";
import {v4} from "uuid";
import {eventStore} from "../database/events/eventStore.ts";

export async function getAudio(lastMessage: AssistantMessage): Promise<string> {
    const blob = await getTtsAudio(lastMessage.text);
    await AudioStorage.writeAudio(lastMessage.id, blob);
    return AudioStorage.getLocalFileUrl(lastMessage.id);
}

export async function sendAudioAndStop(ws: WebsocketConnection, chatId: string, lastMessage: AssistantMessage) {
    const audioUrl = await getAudio(lastMessage);
    if (audioUrl) {
        eventStore.publish({
            type: "audioGenerated",
            chatId,
            userId: ws.userId,
            messageId: lastMessage.id,
            audioUrl
        });
    }
}

export async function getChatsEndpoint(req: Request, res: Response) {
    const from = req.query.from ? new Date(req.query.from as string) : null;

    const chats = await ChatStorage.getUserChats(req.user!.id, from);
    res.send(chats);
}

export async function getChatEndpoint(req: Request, res: Response) {
    const chatId = req.params.chatId;
    if (!chatId) {
        res.status(400).send('Missing chatId parameter');
        return;
    }

    if (req.query.shared === "true") {
        const chatContext = await ChatStorage.readPublicChatContext(chatId);
        if (!chatContext) {
            res.status(404).send('Chat not found');
            return;
        }
        res.send(chatContext);
    } else {
        const chatContext = await ChatStorage.readChatContext(req.user!.id, chatId);

        if (!chatContext) {
            res.status(404).send('Chat not found');
            return;
        }
        res.send(chatContext);
    }
    return;
}

export async function deleteChatEndpoint(req: Request, res: Response) {
    const chatId = req.params.chatId;
    if (!chatId) {
        res.status(400).send('Missing chatId parameter');
        return;
    }

    await eventStore.publish({
        userId: req.user!.id,
        type: "chatDeleted",
        chatId
    });

    // The chat deletion will be handled by the event handler
    res.status(200).send('Chat deletion in progress');
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
    const exclusive = req.body.exclusive;
    if (!chatId || !messageId || exclusive === undefined) {
        const parameters = [
            !chatId ? 'chatId' : '',
            !messageId ? 'messageId' : '',
            exclusive === undefined ? 'exclusive' : ''
        ];

        res.status(400).send(`Missing ${parameters.filter(Boolean).join(', ')} parameter`);
        return;
    }

    await eventStore.publish({
        userId: req.user!.id,
        type: "chatDeletedAfterMessage",
        chatId,
        afterMessageId: messageId,
        exclusive: req.body.exclusive
    });

    // The message deletion will be handled by the event handler
    res.status(200).send('Messages deletion in progress');
}

async function branchChatEndpoint(req: Request, res: Response) {
    const chatId = req.body.chatId;
    const messageId = req.body.messageId;
    if (!chatId || !messageId) {
        res.status(400).send('Missing chatId or messageId parameter');
        return;
    }

    // First check if the chat exists
    const chat = await ChatStorage.readChatContext(req.user!.id, chatId);
    if (!chat) {
        res.status(404).send('Chat not found');
        return;
    }

    // Check if the message exists in the chat
    const message = chat.history.find(m => m.id === messageId);
    if (!message) {
        res.status(404).send('Message not found in chat');
        return;
    }

    // Generate a new chat ID
    const newChatId = v4();

    // Publish the chat branched event
    await eventStore.publish({
        userId: req.user!.id,
        type: "chatBranched",
        chatId: newChatId,
        messageId: messageId,
        branchedFromChatId: chatId
    });

    // Return the new chat ID
    res.status(200).json({
        id: newChatId,
        branchedFromChatId: chatId,
        messageId: messageId
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
