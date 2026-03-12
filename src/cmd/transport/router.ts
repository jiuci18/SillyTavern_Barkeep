import bodyParser from 'body-parser';
import type { Request, RequestHandler, Response, Router } from 'express';
import type { ApiMethod } from '../../types/api';
import { API_ROUTES, dispatchApiRequest, notFoundResponse } from '../api';
import { writeExpressResponse } from './response';

type RouteRegistrar = (path: string, ...handlers: RequestHandler[]) => Router;

function createRouteRegistrars(router: Router): Record<ApiMethod, RouteRegistrar> {
    return {
        GET: router.get.bind(router),
        POST: router.post.bind(router),
        OPTIONS: router.options.bind(router),
    };
}

function toExpressPath(path: string): string {
    return path.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, ':$1');
}

export function registerSillyTavernRouter(router: Router): void {
    const jsonParser = bodyParser.json();
    const registerByMethod = createRouteRegistrars(router);

    for (const route of API_ROUTES) {
        const handlers: RequestHandler[] = [];

        if (route.requiresJsonBody) {
            handlers.push(jsonParser);
        }

        handlers.push(async (req: Request, res: Response): Promise<void> => {
            const result = await dispatchApiRequest(route.method, req.path, req.body);
            writeExpressResponse(res, result);
        });

        registerByMethod[route.method](toExpressPath(route.path), ...handlers);
    }

    router.use((_req: Request, res: Response) => {
        writeExpressResponse(res, notFoundResponse());
    });
}
