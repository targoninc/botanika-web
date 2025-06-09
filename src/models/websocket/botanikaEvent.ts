import {BotanikaEventType} from "./botanikaEventType.ts";

export interface BotanikaEvent<T> {
    type: BotanikaEventType;
    data: T;
}