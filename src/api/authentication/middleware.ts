import {Application} from "express";
import {db} from "../database/supabase.ts";

export function addUserMiddleware(app: Application) {
    app.use(async (req, res, next) => {
        if (req.oidc?.user) {
            await db.from("users")
                .upsert({
                    external_id: req.oidc.user.sub,
                });
        }

        next();
    })
}