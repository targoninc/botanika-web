export interface ResourceReference extends Record<string, any> {
    type: "resource-reference";
    name: string;
    link?: string;
    snippet?: string;
    imageUrl?: string;
    metadata?: any;
}