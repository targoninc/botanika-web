import {BotanikaServerEventType} from "./botanikaServerEventType.ts";

export interface BotanikaServerEvent<T> {
    type: BotanikaServerEventType;
    data: T;
}