import {ChatMessage} from "./ChatMessage";

export interface ChatContext {
    name: string;
    createdAt: number;
    updatedAt: number;
    id: string;
    branched_from_chat_id?: string;
    history: ChatMessage[];
}
