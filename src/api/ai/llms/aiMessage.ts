import {Message} from "ai";

export type AiMessage = Omit<Message, "id">;

export type ReasoningDetail = {
    type: 'text';
    text: string;
    signature?: string;
} | {
    type: 'redacted';
    data: string;
};