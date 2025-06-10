export interface MessageFile extends Record<string, any> {
    id: string;
    base64: string;
    mimeType: string;
}