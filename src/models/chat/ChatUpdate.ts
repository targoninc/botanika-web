import {ChatMessage} from "./ChatMessage";

export interface ChatUpdate {
    chatId: string;
    timestamp: number;
    name?: string;
    messages?: ChatMessage[];
    error?: string;
}