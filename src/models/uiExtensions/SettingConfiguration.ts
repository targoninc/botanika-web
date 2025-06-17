export interface SettingConfiguration {
    key: string,
    icon?: string,
    label: string,
    description: string,
    type: "string" | "color" | "number" | "boolean" | "language" | "date" | "long-string" | "password" | "select";
    options?: string[],
    validator?: (value: any) => string[],
}