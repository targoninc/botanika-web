import {ChatContext} from "../../models/chat/ChatContext";
import {db} from "../database/db.ts";
import {ChatMessage} from "../../models/chat/ChatMessage.ts";
import {ResourceReference} from "../../models/chat/ResourceReference.ts";
import {MessageFile} from "../../models/chat/MessageFile.ts";
import { MessageType } from "@prisma/client";
import {ToolInvocation} from "@ai-sdk/ui-utils";

export class ChatStorage {
    static async writeChatContext(userId: string, chat: ChatContext) {
        await db.chat.upsert({
            where: { id: chat.id },
            update: {
                name: chat.name,
                updatedAt: new Date()
            },
            create: {
                id: chat.id,
                name: chat.name,
                createdAt: new Date(chat.createdAt),
                updatedAt: new Date(),
                user: {
                    connect: { id: userId }
                }
            }
        });

        // Get existing messages
        const existingMsgs = await db.message.findMany({
            where: { chatId: chat.id }
        });

        const toAddMsgs = chat.history.filter(hm => existingMsgs.every(m => m.id !== hm.id));
        const toDeleteMsgs = existingMsgs.filter(hm => chat.history.every(m => m.id !== hm.id));

        // Delete messages that are no longer in the chat history
        for (const message of toDeleteMsgs) {
            await db.message.delete({
                where: { id: message.id }
            });
        }

        // Add new messages
        for (const message of toAddMsgs) {
            const date = new Date(message.time);

            await db.message.create({
                data: {
                    id: message.id,
                    chat: {
                        connect: { id: chat.id }
                    },
                    provider: message.provider,
                    model: message.model,
                    createdAt: date,
                    finished: message.finished,
                    text: message.text,
                    type: message.type as MessageType,
                    hasAudio: message.hasAudio,
                    reasoning: message.reasoning,
                    toolInvocations: message.toolInvocations as any,
                    files: message.files as any
                }
            });
        }
    }

    static async readChatContext(userId: string, chatId: string): Promise<ChatContext> {
        const chat = await db.chat.findFirst({
            where: {
                id: chatId,
                userId: userId
            }
        });

        if (!chat) {
            return null;
        }

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

    static async getUserChats(userId: string, from: Date = null): Promise<ChatContext[]> {
        const whereClause: any = { userId: userId };

        if (from) {
            whereClause.updatedAt = { gt: from };
        }

        const chats = await db.chat.findMany({
            where: whereClause
        });

        return chats.map(c => {
            return <ChatContext>{
                id: c.id,
                name: c.name,
                createdAt: c.createdAt.getTime(),
                updatedAt: c.updatedAt.getTime(),
            }
        }).sort((a, b) => b.createdAt - a.createdAt);
    }
}
