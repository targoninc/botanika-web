/**
 * Enum defining all API endpoints used in the application.
 * This ensures consistency between endpoint declaration and usage.
 */
export enum ApiEndpoint {
    // Configuration endpoints
    CONFIG = "/config",
    CONFIG_KEY = "/config/", // Used with parameter: key

    // Chat endpoints
    CHAT = "/chat",
    CHATS = "/chats",
    CHAT_BY_ID = "/chat/", // Used with parameter: chatId,
    DELETE_AFTER_MESSAGE = "/clearChatAfterMessage", // Used with parameters: chatId, messageId

    // Models endpoint
    MODELS = "/models",

    // MCP endpoints
    MCP_CONFIG = "/mcpConfig",
    MCP_SERVER = "/mcpServer",

    // Shortcut configuration endpoints
    SHORTCUT_CONFIG = "/shortCutConfig",

    // App data path endpoint
    OPEN_APP_DATA_PATH = "/openAppDataPath",

    // OpenAI key endpoint
    OPENAI_KEY = "/openaiKey",

    // Audio endpoints
    AUDIO = "/audio",
    TRANSCRIBE = "/transcribe"
}
