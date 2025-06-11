import {Configuration} from "../models/Configuration";
import {appDataPath} from "./appData";
import {Application, Request} from "express";
import {ApiEndpoint} from "../models/ApiEndpoints";
import {execSync} from "child_process";
import {BotanikaFeature} from "../models/features/BotanikaFeature";
import {db} from "./database/db.ts";


export async function getConfig(userId: string): Promise<Configuration> {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { configuration: true }
    });
    return user.configuration as unknown as Configuration;
}

export async function setConfig(req: Request, newConfig: Configuration) {
    await db.user.update({
        where: { externalId: req.oidc.user.sub },
        data: { configuration: newConfig as any }
    });
}

export async function getFeatureOption(req: Request, feature: BotanikaFeature, optionKey: string) {
    return (await getConfig(req.user.id)).featureOptions[feature][optionKey] ?? null;
}

export function addConfigEndpoints(app: Application) {
    app.get(ApiEndpoint.CONFIG, async (req, res) => {
        res.status(200).send(await getConfig(req.user.id));
    });

    app.put(ApiEndpoint.CONFIG, async (req, res) => {
        await setConfig(req, req.body);
        res.status(200).send(await getConfig(req.user.id));
    });

    app.put(`${ApiEndpoint.CONFIG_KEY}:key`, async (req, res) => {
        const key = req.params.key;
        const value = req.body.value;
        const config = await getConfig(req.user.id);
        config[key] = value;
        await setConfig(req, config);
        res.status(200).send(config);
    });

    app.post(ApiEndpoint.OPEN_APP_DATA_PATH, async (req, res) => {
        switch (process.platform) {
            case 'win32':
                execSync(`start ${appDataPath}`);
                break;
            case "linux":
                execSync(`xdg-open ${appDataPath}`);
                break;
            case "darwin":
                execSync(`open ${appDataPath}`);
                break;
        }

        res.status(200).send();
    });
}
