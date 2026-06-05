//! Express transport adapter for the shared API pipeline.

import type { NextFunction, Request, Response, Router } from 'express';
import { createApiErrorResponse } from '../../utils/errors';
import { createExpressTransportRequest, handleApiTransportRequest, writeExpressResponse } from './pipeline';

/** Register an Express router as an adapter for the API transport pipeline. */
export function registerExpressTransport(router: Router): void {
    router.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await handleApiTransportRequest(createExpressTransportRequest(req));
            writeExpressResponse(res, result);
        } catch (error) {
            next(error);
        }
    });

    router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
        writeExpressResponse(res, createApiErrorResponse(error));
    });
}
