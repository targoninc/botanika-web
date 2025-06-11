import {ChatContext} from "../../models/chat/ChatContext";
import {db} from "../database/supabase.ts";
import {ChatMessage} from "../../models/chat/ChatMessage.ts";
import {ResourceReference} from "../../models/chat/ResourceReference.ts";
import {MessageFile} from "../../models/chat/MessageFile.ts";

export class ChatStorage {
    static async writeChatContext(userId: string, chat: ChatContext) {
        await db.from("chats").upsert({
            user_id: userId,
            id: chat.id,
            name: chat.name,
            created_at: (new Date(chat.createdAt)).toISOString(),
            updated_at: (new Date()).toISOString()
        });

        const existingMsgs = (await db.from("messages")
            .select("*")
            .eq("chat_id", chat.id)).data;
        const toAddMsgs = chat.history.filter(hm => existingMsgs.every(m => m.id !== hm.id));
        const toDeleteMsgs = existingMsgs.filter(hm => chat.history.every(m => m.id !== hm.id));

        for (const message of toDeleteMsgs) {
            await db.from("messages")
                .delete()
                .eq("id", message.id);
        }

        for (const message of toAddMsgs) {
            const date = (new Date(message.time)).toISOString();

            await db.from("messages").insert({
                id: message.id,
                chat_id: chat.id,
                provider: message.provider,
                model: message.model,
                created_at: date,
                finished: message.finished,
                text: message.text,
                type: message.type,
                hasAudio: message.hasAudio,
                references: message.references,
                files: message.files
            });
        }
    }

    static async readChatContext(userId: string, chatId: string): Promise<ChatContext> {
        const chat = (await db.from("chats")
            .select("*")
            .eq("id", chatId)
            .eq("user_id", userId))
            .data[0];
        if (!chat) {
            return null;
        }

        const messages = (await db.from("messages")
            .select("*")
            .eq("chat_id", chatId))
            .data;

        return {
            id: chat.id,
            name: chat.name,
            createdAt: new Date(chat.created_at).getTime(),
            updatedAt: new Date(chat.updated_at).getTime(),
            history: messages.map(m => {
                return <ChatMessage>{
                    id: m.id,
                    finished: m.finished,
                    text: m.text,
                    model: m.model,
                    time: new Date(m.created_at).getTime(),
                    type: m.type,
                    provider: m.provider,
                    hasAudio: m.hasAudio,
                    references: m.references as ResourceReference[],
                    files: m.files as MessageFile[],
                };
            })
        }
    }

    static async deleteChatContext(userId: string, chatId: string) {
        await db.from("chats").delete().eq("id", chatId).eq("user_id", userId);
    }

    static async getUserChats(userId: string, from: Date = null): Promise<ChatContext[]> {
        let query = db.from("chats").select("*").eq("user_id", userId);

        if (from) {
            query = query.gt("updated_at", from.toISOString());
        }

        const chats = (await query).data;
        return chats.map(c => {
            return <ChatContext>{
                id: c.id,
                name: c.name,
                createdAt: new Date(c.created_at).getTime(),
                updatedAt: new Date(c.updated_at).getTime(),
            }
        }).sort((a, b) => b.createdAt - a.createdAt);
    }
}