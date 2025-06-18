import {AnyNode} from "@targoninc/jess";
import {FeatureType} from "./FeatureType.ts";

export interface SettingConfiguration {
    key: string,
    icon?: string,
    label: string,
    description?: string,
    descriptionContent?: AnyNode[],
    needsFeatureType?: FeatureType,
    type: "string" | "color" | "number" | "boolean" | "language" | "date" | "long-string" | "password" | "select";
    options?: string[],
    validator?: (value: any) => string[],
}