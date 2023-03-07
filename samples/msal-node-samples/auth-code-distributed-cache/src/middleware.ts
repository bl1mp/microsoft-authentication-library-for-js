/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { UrlString } from '@azure/msal-common';
import { InteractionRequiredAuthError, ResponseMode } from '@azure/msal-node';
import express, { Request, Response, NextFunction, Router } from 'express';

import { AppConfig, AuthProvider } from './AuthProvider';
import UrlUtils from './UrlUtils';

export type AuthOptions = {
    appConfig: AppConfig
    authProvider: AuthProvider
    protectedResources: {
        [route: string]: [string, string[]];
    }
};

export const auth = (options: AuthOptions): Router => {
    const appRouter = express.Router();

    // ensure session is available
    appRouter.use((req: Request, res: Response, next: NextFunction) => {

        if (!req.session) {
            throw new Error("Session not found. Please check your session middleware configuration.");
        }

        next();
    });

    // handle redirect response from service
    appRouter.post(UrlUtils.getPathFromUrl(options.appConfig.redirectUri), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tokenResponse = await options.authProvider.getTokenInteractive({
                ...req.session.tokenRequest!,
                code: req.body.code,
            }, req.body, req.session.id);

            req.session.isAuthenticated = true;
            req.session.account = tokenResponse?.account!; // account won't be null in this grant type

            const { redirectTo } = JSON.parse(Buffer.from(req.body.state, "base64").toString("utf8"));
            res.redirect(redirectTo); // redirect back to original route
        } catch (error) {
            next(error);
        }
    });

    // ensure user is authenticated
    appRouter.use(async (req: Request, res: Response, next: NextFunction) => {
        const isRedirectUri = UrlUtils.getCanonicalUrlFromRequest(req) === UrlString.canonicalizeUri(options.appConfig.redirectUri);

        if (!req.session.isAuthenticated && !isRedirectUri) {
            const { authCodeUrl, state } = await options.authProvider.prepareTokenRequest({
                responseMode: ResponseMode.FORM_POST,
                redirectUri: options.appConfig.redirectUri,
                scopes: [],
            }, req.session.id);

            req.session.tokenRequest = {
                redirectUri: options.appConfig.redirectUri,
                scopes: [],
                state,
                code: ""
            }; // save token request params to session, which will be used to acquire token after redirect

            return res.redirect(authCodeUrl);
        }

        next();
    });

    // acquire token for routes calling protected resources
    Object.entries(options.protectedResources).forEach((value) => {
        const [route, [resource, scopes]] = value;

        appRouter.get(route, async (req: Request, res: Response, next: NextFunction) => {
            try {
                const tokenResponse = await options.authProvider.getTokenSilent({
                    account: req.session.account!,
                    scopes: scopes,
                }, req.session.id);

                req.session.protectedResources = {
                    ...req.session.protectedResources,
                    [resource]: {
                        callingRoute: route,
                        accessToken: tokenResponse?.accessToken!,
                    }
                };

                next();
            } catch (error) {
                if (error instanceof InteractionRequiredAuthError) {
                    const { authCodeUrl, state } = await options.authProvider.prepareTokenRequest({
                        responseMode: ResponseMode.FORM_POST,
                        redirectUri: options.appConfig.redirectUri,
                        scopes: scopes,
                    }, req.session.id, route);

                    req.session.tokenRequest = {
                        redirectUri: options.appConfig.redirectUri,
                        scopes,
                        state,
                        code: ""
                    }; // save token request params to session, which will be used to acquire token after redirect

                    return res.redirect(authCodeUrl);
                }

                next(error);
            }
        });
    });

    return appRouter;
};
