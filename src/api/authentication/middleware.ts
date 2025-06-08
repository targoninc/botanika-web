import {Application, RequestHandler} from "express";
import {db} from "../database/supabase.ts";
import {Tables} from "../database/supabaseDefinitions.ts";

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

export function addUserMiddleware(app: Application) {
    app.use(async (req, res, next) => {
        if (req.oidc?.user) {
            await db.from("users")
                .upsert({
                    external_id: req.oidc.user.sub,
                });

            req.user = (await db.from("users").select("*").eq("external_id", req.oidc.user.sub).single()).data;
        }

        next();
    });
}