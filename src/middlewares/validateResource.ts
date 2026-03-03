
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const validate = (schema: z.ZodObject<any, any>) => (req: Request, res: Response, next: NextFunction) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (e: any) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors: e.errors.map((err: any) => ({
                path: err.path.join('.'),
                message: err.message
            }))
        });
    }
};

export default validate;
