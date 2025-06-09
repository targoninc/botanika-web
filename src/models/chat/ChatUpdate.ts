import {ChatMessage} from "./ChatMessage";

export interface ChatUpdate {
    chatId: string;
    timestamp: number;
    messages?: ChatMessage[];
    error?: string;
}