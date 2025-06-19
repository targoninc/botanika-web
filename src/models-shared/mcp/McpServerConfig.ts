export interface McpServerConfig {
    name?: string;
    url: string;
    id: string;
    enabled: boolean;
    headers?: Record<string, string>;
}
