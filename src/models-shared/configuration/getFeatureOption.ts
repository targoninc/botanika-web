import {Configuration} from "./Configuration.ts";
import {BotanikaFeature} from "./BotanikaFeature.ts";

export function getFeatureOption(config: Configuration, option: BotanikaFeature): any {
    return (config?.featureOptions ?? {})[option] ?? {};
}