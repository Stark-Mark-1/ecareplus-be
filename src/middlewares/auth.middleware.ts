import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthenticatedRequest extends Request {
    user?: any;
}
export type AuthRequest = AuthenticatedRequest; // Backward compatibility if needed


export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer <token>

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid or expired token',
                    error: 'FORBIDDEN'
                });
            }

            req.user = user;
            next();
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Authorization token required',
            error: 'UNAUTHORIZED'
        });
    }
};
