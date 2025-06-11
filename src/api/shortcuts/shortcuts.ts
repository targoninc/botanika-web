import path from "path";
import {Application} from "express";
import {appDataPath} from "../appData";
import {defaultShortcuts} from "../../models/shortcuts/defaultShortcuts";
import {ShortcutConfiguration} from "../../models/shortcuts/ShortcutConfiguration";
import {ApiEndpoint} from "../../models/ApiEndpoints";
import fs from "fs";
import {mkdir} from "fs/promises";
import {db} from "../database/db.ts";

let config: ShortcutConfiguration;
let configPath: string;

async function initializeConfig() {
    configPath = path.join(appDataPath, 'shortcuts.json');

    if (!fs.existsSync(appDataPath)) {
        await mkdir(appDataPath, {recursive: true});
    }

    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(defaultShortcuts, null, 4));
    }
    config = JSON.parse(fs.readFileSync(configPath).toString()) as ShortcutConfiguration;
}

export async function getConfig(userId: string) {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { shortcuts: true }
    });

    const shortCutConfig = user.shortcuts as any;
    let out = {};
    for (const key of Object.keys(defaultShortcuts)) {
        out[key] = shortCutConfig[key] ?? defaultShortcuts[key];
    }
    return out;
}

export async function setConfig(userId: string, sc: ShortcutConfiguration) {
    await db.user.update({
        where: { id: userId },
        data: { shortcuts: sc as any }
    });
}

export function addShortcutEndpoints(app: Application) {
    initializeConfig().then();

    app.get(ApiEndpoint.SHORTCUT_CONFIG, async (req, res) => {
        res.status(200).send(await getConfig(req.user.id));
    });

    app.post(ApiEndpoint.SHORTCUT_CONFIG, async (req, res) => {
        const sc = req.body as ShortcutConfiguration;
        await setConfig(req.user.id, sc);
        res.status(200).send();
    });
}
