import {Application, Request, Response, RequestHandler} from "express";
import {db} from "../database/supabase.ts";
import {Tables} from "../../models/supabaseDefinitions.ts";
import {ApiEndpoint} from "../../models/ApiEndpoints.ts";
import {userWebsocketMap, userWebsocketReverseMap} from "../../ui-server/ui-server.ts";
import {v4 as uuidv4} from "uuid";
import {CLI} from "../CLI.ts";

declare module "express-serve-static-core" {
    interface Request {
        user?: Tables<"users">
    }
}

export const isAdmin: RequestHandler = (req, res, next) => {
    if (req.user?.isAdmin){
        return next();
    }

    res.status(403).send("Not authorized");
};

async function upsertAndGetUser(req: Request) {
    await db.from("users")
        .upsert({
            external_id: req.oidc.user.sub,
        });
    return (await db.from("users").select("*").eq("external_id", req.oidc.user.sub).single()).data;
}

function getWebsocketId(userId: string) {
    if (userWebsocketReverseMap.has(userId)) {
        return userWebsocketReverseMap.get(userId);
    }

    CLI.debug(`Creating WS token for userId ${userId}`);
    const id = uuidv4();
    userWebsocketMap.set(id, userId);
    userWebsocketReverseMap.set(userId, id);
    return id;
}

export function addUserMiddleware(app: Application) {
    const userMap = new Map<string, Tables<"users">>();

    app.use(async (req, res, next) => {
        if (req.oidc?.user) {
            if (!userMap.has(req.oidc.user.sub)) {
                req.user = await upsertAndGetUser(req);
                getWebsocketId(req.oidc.user.sub);
                userMap.set(req.oidc.user.sub, req.user);
            } else {
                req.user = userMap.get(req.oidc.user.sub);
            }
        }

        next();
    });
}

export function addUserEndpoints(app: Application) {
    app.get(ApiEndpoint.GET_USER, async (req: Request, res: Response) => {
        return res.json({
            ...req.user,
            ...req.oidc.user
        });
    });

    app.get(ApiEndpoint.WS_TOKEN, (req: Request, res: Response) => {
        if (!req.oidc?.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const token = getWebsocketId(req.oidc.user.sub);
        return res.json({ token });
    });
}
