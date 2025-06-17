export interface MessageFile extends Record<string, any> {
    id: string;
    name?: string;
    base64: string;
    mimeType: string;
}