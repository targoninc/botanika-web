import {SettingConfiguration} from "./SettingConfiguration.ts";

export interface FeatureConfigurationInfo {
    enabled: boolean;
    envVars: {
        key: string;
        isSet: boolean;
    }[];
    options: SettingConfiguration[];
}