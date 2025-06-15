import {ChatContext} from "../../models/chat/ChatContext";
import {db} from "../database/db.ts";
import {ChatMessage} from "../../models/chat/ChatMessage.ts";
import {MessageFile} from "../../models/chat/MessageFile.ts";
import {Chat, MessageType, Prisma} from "@prisma/client";
import {ToolInvocation} from "@ai-sdk/ui-utils";
import {MessageIncrement, UserIncrement} from "../database/events/incrementProjector.ts";
import {CLI} from "../CLI.ts";

export class ChatStorage {
    static async applyIncrements(userId: string, increment: UserIncrement) {
        const chatCreations: Chat[] = [];
        const messageCreations: Map<string, Prisma.MessageCreateManyChatInput[]> = new Map();
        const chatUpdates: Prisma.ChatUpdateArgs[] = [];
        const messageTextAppend: { messageId: string, additionalText: string }[] = [];

        for (const [chatId, chatIncrement] of increment.chatIncrements.entries()){
            switch (chatIncrement.type) {
                case "newChat":
                    chatCreations.push({
                        id: chatId,
                        name: chatIncrement.chat.name,
                        createdAt: new Date(chatIncrement.chat.createdAt),
                        updatedAt: new Date(chatIncrement.chat.updatedAt),
                        branchedFromChatId: chatIncrement.chat.branched_from_chat_id ?? null,
                        userId: userId,
                    });

                    for (const message of chatIncrement.chat.history) {
                        const newMessage = createMessageFromNewMessage(message.id, message);

                        let newMessages = messageCreations.get(chatId);
                        if (!newMessages) {
                            newMessages = [];
                            messageCreations.set(chatId, newMessages);
                        }

                        newMessages.push(newMessage);
                    }

                    break;
                case "addToChat": {
                    const chatUpdate: Prisma.ChatUpdateArgs["data"] = {
                        updatedAt: new Date(chatIncrement.latestUpdateTimestamp)
                    };

                    if (chatIncrement.name) {
                        chatUpdate.name = chatIncrement.name;
                    }

                    const newMessages: Prisma.MessageCreateManyChatInput[] = [];
                    const updatedMessages: Prisma.MessageUpdateArgs[] = [];
                    for (const [messageId, messageIncrement] of chatIncrement.messageIncrements.entries()) {
                        switch (messageIncrement.type) {
                            case "userMessageCreatedEvent": {
                                const message = createMessageFromNewMessage(messageId, messageIncrement.message);

                                newMessages.push(message);

                                break;
                            }
                            case "addToMessage": {
                                const updateMessage = createMessageFromAddToMessage(messageId, chatId, messageIncrement);

                                updatedMessages.push(updateMessage);

                                break;
                            }
                        }
                    }

                    chatUpdate.messages = {
                        createMany: {
                            data: newMessages,
                        },
                        updateMany: updatedMessages
                    }

                    chatUpdates.push({
                        where: {id: chatId},
                        data: chatUpdate,
                        include: {
                            messages: true
                        }
                    });
                    break;
                }
            }
        }

        db.$transaction(async transactionClient => {
            const createChats = transactionClient.chat.createMany({
                data: chatCreations
            }).then(async chats => {
                CLI.debug(`Created ${chats.count} new chats`);
            });

            const updateChats = transactionClient.chat.updateMany({
                data: chatUpdates
            }).then(async chats => {
                CLI.debug(`Updated ${chats.count} chats`);
            });

            const updateMessages = await transactionClient.message.findMany({
                where: {
                    id: {
                        in: messageTextAppend.map(message => message.messageId)
                    }
                }
            });

            await transactionClient.message.updateMany({
                data: updateMessages.map(message => {
                    const append = messageTextAppend.find(m => m.messageId === message.id);
                    if (append) {
                        return {
                            id: message.id,
                            text: message.text + append.additionalText
                        };
                    }
                    return { id: message.id };
                })
            }).then(async messages => {
                CLI.debug(`Updated ${messages.count} messages with appended text`);
            });

            await createChats;
            await db.chat.updateMany({
                data: [...messageCreations.entries()].map(([chatId, messages]) => ({
                    chatId,
                    messages: {
                        createMany: {
                            data: messages
                        }
                    }
                }))
            }).then(async messages => {
                CLI.debug(`Created ${messages.count} new messages`);
            });

            await updateChats;
        });


        function createMessageFromNewMessage(
            messageId: string,
            message: ChatMessage
        ) : Prisma.MessageCreateManyChatInput {
            let text: Prisma.MessageCreateManyChatInput["text"] | null = null;
            let model: Prisma.MessageCreateManyChatInput["model"] | null = null;
            let finished: Prisma.MessageCreateManyChatInput["finished"] | null = false;
            let provider: Prisma.MessageCreateManyChatInput["provider"] | null = null;
            let hasAudio: Prisma.MessageCreateManyChatInput["hasAudio"] = false;
            let reasoning: Prisma.MessageCreateManyChatInput["reasoning"] | null = null;
            let files: Prisma.MessageCreateManyChatInput["files"] | null = null;

            const createdAt: Date = new Date(message.time);
            let toolInvocations: ToolInvocation[] | null = null;

            switch (message.type) {
                case "tool": {
                    toolInvocations = [{
                        state: "result",
                        toolName: message.toolResult.toolName,
                        result: message.toolResult.result,
                        toolCallId: message.toolResult.toolCallId,
                        step: 0, // TODO: Where do we get step from?
                        args: null // TODO: Where do we get args from?
                    }];

                    break;
                }
                case "user":
                    text = message.text;
                    files = message.files as any;

                    break;
                case "system":
                    text = message.text;

                    break;
                case "assistant":
                    text = message.text;
                    model = message.model;
                    finished = message.finished;
                    provider = message.provider;
                    hasAudio = message.hasAudio;
                    reasoning = message.reasoning as any;
                    files = message.files as any;

                    break;
            }

            return {
                id: messageId,
                createdAt: createdAt,
                type: message.type as MessageType,
                text: text,
                finished: finished,
                provider: provider,
                model: model,
                hasAudio: hasAudio,
                reasoning: reasoning as any,
                toolInvocations: toolInvocations as any,
                files: files as any
            };
        }

        function createMessageFromAddToMessage(
            messageId: string,
            chatId: string,
            messageIncrement: MessageIncrement & { type: "addToMessage" }
        ): Prisma.MessageUpdateArgs {
            const updateMessage: Prisma.MessageUpdateArgs["data"] = {
                id: messageId,
                chatId,
            };

            if (messageIncrement.audio !== undefined) {
                updateMessage.hasAudio = messageIncrement.audio;
            }

            if (messageIncrement.text !== undefined) {
                messageTextAppend.push({
                    messageId,
                    additionalText: messageIncrement.text
                });
            }

            if (messageIncrement.finished !== undefined) {
                updateMessage.finished = messageIncrement.finished;
            }

            if (messageIncrement.files !== undefined) {
                updateMessage.files = messageIncrement.files as any;
            }

            return {
                where: { id: messageId },
                data: updateMessage
            };
        }
    }

    static async readChatContext(userId: string, chatId: string): Promise<ChatContext | null> {
        const chat = await db.chat.findFirst({
            where: {
                id: chatId,
                userId: userId
            }
        });

        if (!chat) {
            return null;
        }

        return await ChatStorage.addDataToChat(chatId, chat);
    }

    static async readPublicChatContext(chatId: string): Promise<ChatContext | null> {
        const chat = await db.chat.findFirst({
            where: {
                id: chatId,
                shared: true
            }
        });

        if (!chat) {
            return null;
        }

        return await ChatStorage.addDataToChat(chatId, chat);
    }

    private static async addDataToChat(chatId: string, chat: Chat) {
        const messages = await db.message.findMany({
            where: {
                chatId: chatId
            }
        });

        return {
            id: chat.id,
            name: chat.name,
            createdAt: chat.createdAt.getTime(),
            updatedAt: chat.updatedAt.getTime(),
            shared: chat.shared,
            userId: chat.userId,
            history: messages.map(m => {
                return <ChatMessage>{
                    id: m.id,
                    finished: m.finished,
                    text: m.text,
                    model: m.model,
                    time: m.createdAt.getTime(),
                    type: m.type,
                    provider: m.provider,
                    hasAudio: m.hasAudio,
                    reasoning: m.reasoning,
                    toolInvocations: m.toolInvocations as unknown as ToolInvocation[],
                    files: m.files as MessageFile[],
                };
            }).sort((a, b) => b.time - a.time)
        }
    }

    static async deleteChatContext(userId: string, chatId: string) {
        await db.chat.deleteMany({
            where: {
                id: chatId,
                userId: userId
            }
        });
    }

    static async getUserChats(userId: string, from: Date | null = null): Promise<Omit<ChatContext, "history">[]> {
        const whereClause: any = { userId: userId };

        if (from) {
            whereClause.updatedAt = { gt: from };
        }

        const chats = await db.chat.findMany({
            where: whereClause
        });

        return chats.map(c => {
            return {
                id: c.id,
                name: c.name,
                shared: c.shared,
                userId: c.userId,
                createdAt: c.createdAt.getTime(),
                updatedAt: c.updatedAt.getTime(),
            }
        }).sort((a, b) => b.createdAt - a.createdAt);
    }
}
