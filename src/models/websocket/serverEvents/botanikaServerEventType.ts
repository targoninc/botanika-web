export enum BotanikaServerEventType {
    chatCreated = "chatCreated",
    messageChunkUpdate = "messageChunkUpdate",
    messageCompleted = "messageCompleted",
    newMessage = "userMessageCreated",
    error = "error",
    log = "log",
    warning = "warning",
}