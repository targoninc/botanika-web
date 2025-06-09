import {BotanikaEventType} from "./botanikaEventType.ts";

export interface BotanikaClientEvent<T> {
    type: BotanikaEventType;
    data: T;
}