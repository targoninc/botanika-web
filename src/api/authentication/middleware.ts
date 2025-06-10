import {Application, Request, Response, RequestHandler} from "express";
import {db} from "../database/supabase.ts";
import {Tables} from "../../models/supabaseDefinitions.ts";
import {ApiEndpoint} from "../../models/ApiEndpoints.ts";
import {auth, Session} from "express-openid-connect";

declare module "express-serve-static-core" {
    interface Request {
        user?: Tables<"users">,
        appSession: Session & {
            user?: Tables<"users">
        }
    }
}

export const isAdmin: RequestHandler = (req, res, next) => {
    if (req.appSession?.user.isAdmin){
        return next();
    }

    res.status(403).send("Not authorized");
};

async function upsertAndGetUser(externalId: string) {
    await db.from("users")
        .upsert({
            external_id: externalId
        });
    return (await db.from("users").select("*").eq("external_id", externalId).single()).data;
}

function base64Decode(input: string) {
    return Buffer.from(input, "base64").toString();
}

export function extractExternalId(idToken: string) {
    return JSON.parse(base64Decode(idToken.split(".", 3)[1])).sub;
}

export function addAuthenticationMiddleware(app: Application) {
    app.use(auth({
        authRequired: true,
        secret: process.env.OIDC_SECRET,
        clientID: process.env.OIDC_CLIENT_ID,
        issuerBaseURL: process.env.OIDC_ISSUER_BASE_URL,
        baseURL: process.env.OIDC_BASE_URL || `http://localhost:${process.env.PORT || 3001}`,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        clientAuthMethod: "client_secret_post",
        idpLogout: true,
        afterCallback: async (req, res, session) => {
            const userId = extractExternalId(session.id_token);
            const user = (await db.from("users").select("*").eq("external_id", userId).single()).data;
            return {
                ...session,
                user
            }
        }
    }));

    app.use(async (req, res, next) => {
        if (req.oidc?.user) {
            if(!req.appSession.user) {
                req.appSession.user = await upsertAndGetUser(extractExternalId(req.oidc.idToken));
            }
            req.user = req.appSession.user;
        }

        next();
    });
}

export function addUserEndpoints(app: Application) {
    app.get(ApiEndpoint.GET_USER, async (req: Request, res: Response) => {
        res.json({
            ...req.user,
            ...req.oidc.user
        });
    });
}
