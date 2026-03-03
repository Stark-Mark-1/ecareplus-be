
import { Router } from 'express';
import passport from 'passport';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { BAD_REQUEST, UNAUTHORIZED } from '../utils/httpStatusCodes';
import { handleGoogleAuth } from './auth.service';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Google OAuth Routes

router.get('/google/doctor', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: 'doctor' })).toString('base64');
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        state
    })(req, res, next);
});
router.get('/google/patient', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: 'patient' })).toString('base64');
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        state
    })(req, res, next);
});

// Callback
router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/login?error=auth_failed` }),
    (req: any, res) => {
           const result = req.user;
        if (result && result.success) {
            const { token, redirectTo, user } = result;
            const userType = user.specialty ? 'doctor' : 'patient';
            
              const redirectUrl = `${FRONTEND_URL}${redirectTo}?token=${token}&userType=${userType}&isNewUser=${result.isNewUser}&isReturningIncompleteUser=${result.isReturningIncompleteUser || false}`;
            
            res.redirect(redirectUrl);
        } else {
            res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
        }
    }
);


router.post('/google/verify', asyncHandler(async (req: any, res: any, next: any) => {
    const { googleToken, userType } = req.body;

    if (!googleToken || !userType) {
        throw new AppError('Google token and user type are required', BAD_REQUEST);
    }

    if (!['doctor', 'patient'].includes(userType)) {
        throw new AppError('User type must be either "doctor" or "patient"', BAD_REQUEST);
    }

    // Verify Google token
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${googleToken}`);
    
    if (!response.ok) {
        throw new AppError('Invalid Google token', UNAUTHORIZED);
    }

    const googleUser = await response.json();
    
    if (!googleUser.email) {
        throw new AppError('No email found in Google profile', BAD_REQUEST);
    }

    const result = await handleGoogleAuth(
        googleUser.id,
        googleUser.email,
        googleUser.name,
        userType
    );

    return res.status(200).json({
        success: true,
        message: result.isNewUser ? 'Account created successfully with Google' : 
                result.isReturningIncompleteUser ? 'Welcome back! Please complete your profile' : 
                'Login successful',
        data: {
            userId: (result.user as any)?.id,
            token: result.token,
            email: (result.user as any)?.email,
            name: (result.user as any)?.name,
            userType,
            isNewUser: result.isNewUser,
            isReturningIncompleteUser: result.isReturningIncompleteUser || false,
            redirectTo: result.redirectTo || '/dashboard',
            onboardingStep: (result.user as any)?.onboardingStep
        }
    });
}));

export default router;
