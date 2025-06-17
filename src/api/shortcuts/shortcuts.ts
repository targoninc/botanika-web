import {Application, Request} from "express";
import {defaultShortcuts} from "../../models-shared/shortcuts/defaultShortcuts";
import {ShortcutConfiguration} from "../../models-shared/shortcuts/ShortcutConfiguration";
import {ApiEndpoint} from "../../models-shared/ApiEndpoints";
import {db, updateUser} from "../database/db.ts";

export async function getConfig(userId: string) {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { shortcuts: true }
    });

    const shortCutConfig = user?.shortcuts ?? {};
    const out = {} as ShortcutConfiguration;
    for (const key of Object.keys(defaultShortcuts)) {
        out[key] = shortCutConfig[key] ?? defaultShortcuts[key];
    }
    return out;
}

export async function setConfig(req: Request, sc: ShortcutConfiguration) {
    await updateUser(req.user.id, {
        shortcuts: sc
    });
}

export function addShortcutEndpoints(app: Application) {
    app.get(ApiEndpoint.SHORTCUT_CONFIG, async (req, res) => {
        res.status(200).send(await getConfig(req.user.id));
    });

    app.post(ApiEndpoint.SHORTCUT_CONFIG, async (req, res) => {
        const sc = req.body as ShortcutConfiguration;
        await setConfig(req, sc);
        res.status(200).send();
    });
}
