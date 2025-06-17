import {Application, Request, RequestHandler, Response} from "express";
import {db} from "../database/db.ts";
import {ApiEndpoint} from "../../models-shared/ApiEndpoints.ts";
import {auth, Session} from "express-openid-connect";
import {base64Decode} from "./base64Decode.ts";
import { User } from "@prisma/client";

declare module "express-serve-static-core" {
    interface Request {
        user?: User,
        appSession: Session & {
            user?: User
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
    await db.user.upsert({
        where: { externalId },
        update: {},
        create: { externalId }
    });

    return db.user.findUnique({
        where: {externalId}
    });
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
        baseURL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        clientAuthMethod: "client_secret_post",
        idpLogout: true,
        afterCallback: async (req, res, session) => {
            const userId = extractExternalId(session.id_token);
            const user = await db.user.findUnique({
                where: { externalId: userId }
            });
            return {
                ...session,
                user
            }
        }
    }));

    app.use(async (req, res, next) => {
        if (req.oidc?.user) {
            if (!req.appSession.user) {
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

    app.post(ApiEndpoint.DELETE_USER, async (req: Request, res: Response) => {
        await db.user.delete({
            where: {
                id: req.user.id
            }
        });

        res.send();
    })
}
