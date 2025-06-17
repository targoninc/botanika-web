import {AnyNode} from "@targoninc/jess";

export interface SettingConfiguration {
    key: string,
    icon?: string,
    label: string,
    description?: string,
    descriptionContent?: AnyNode[],
    type: "string" | "color" | "number" | "boolean" | "language" | "date" | "long-string" | "password" | "select";
    options?: string[],
    validator?: (value: any) => string[],
}