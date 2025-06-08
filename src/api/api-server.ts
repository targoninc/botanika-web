import express, {Application} from "express";
import cors from "cors";
import {addTranscribeEndpoints} from "./ai/tts/endpoints.ts";
import {createEndpoints} from "./endpoints.ts";
import dotenv from "dotenv";

import {auth} from "express-openid-connect"
import {addUserMiddleware} from "./authentication/middleware.ts";

dotenv.config();

export let mcpApp: Application;

export async function apiServer(app: Application) {
    app.use(cors({
        origin: "*",
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        preflightContinue: false,
        optionsSuccessStatus: 204,
    }));

    /*app.use((req, res, next) => {
        console.log(req.path);
        next();
    });*/

    app.use(auth({
        authRequired: true,
        secret: process.env.OIDC_SECRET,
        clientID: process.env.OIDC_CLIENT_ID,
        issuerBaseURL: process.env.OIDC_ISSUER_BASE_URL,
        baseURL: process.env.OIDC_BASE_URL || `http://localhost:${process.env.PORT || 3001}`,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        clientAuthMethod: "client_secret_post",
        idpLogout: true
    }));

    addUserMiddleware(app);

    addTranscribeEndpoints(app);
    app.use(express.json());

    createEndpoints(app);

    return app;
}
