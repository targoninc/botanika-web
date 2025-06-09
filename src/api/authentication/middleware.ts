import {Application, Request, RequestHandler} from "express";
import {db} from "../database/supabase.ts";
import {Tables} from "../../models/supabaseDefinitions.ts";
import {ApiEndpoint} from "../../models/ApiEndpoints.ts";
import {userWebsocketMap} from "../../ui-server/ui-server.ts";
import {v4 as uuidv4} from "uuid";

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
    const id = uuidv4();
    userWebsocketMap.set(id, userId);
}

export function addUserMiddleware(app: Application) {
    const userMap = new Map<string, Tables<"users">>();

    app.use(async (req, res, next) => {
        if (req.oidc?.user) {
            if (!userMap.has(req.oidc.user.sub)) {
                req.user = await upsertAndGetUser(req);
                userMap.set(req.oidc.user.sub, req.user);
            } else {
                req.user = userMap.get(req.oidc.user.sub);
            }
        }

        next();
    });
}

export function addUserEndpoints(app: Application) {
    app.get(ApiEndpoint.GET_USER, async (req, res) => {
        return res.json({
            ...req.user,
            ...req.oidc.user
        });
    });
}