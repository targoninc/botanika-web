import {SettingConfiguration} from "./SettingConfiguration.ts";
import {FeatureSettings} from "./FeatureSettings.ts";

export interface ProviderSettings {
    keys: SettingConfiguration[],
    features: FeatureSettings[],
}