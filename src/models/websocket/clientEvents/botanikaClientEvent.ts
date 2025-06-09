import {BotanikaClientEventType} from "./botanikaClientEventType.ts";

export interface BotanikaClientEvent<T> {
    type: BotanikaClientEventType;
    data: T;
}