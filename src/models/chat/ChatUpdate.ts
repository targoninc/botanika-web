import {ChatMessage} from "./ChatMessage";

export interface ChatUpdate {
    chatId: string;
    timestamp: number;
    name?: string;
    shared?: boolean;
    messages?: ChatMessage[];
    error?: string;
}