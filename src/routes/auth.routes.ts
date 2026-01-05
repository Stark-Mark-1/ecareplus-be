import { Router, Request, Response } from 'express';
import passport from '../services/googleAuth.service';
import { handleGoogleAuth } from '../services/googleAuth.service';

const router = Router();

// Google OAuth initiation for doctors
router.get('/google/doctor', (req: Request, res: Response, next) => {
    // Store user type in session
    req.session = req.session || {};
    (req.session as any).userType = 'doctor';
    
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: 'doctor' // Pass user type in state parameter
    })(req, res, next);
});

// Google OAuth initiation for patients
router.get('/google/patient', (req: Request, res: Response, next) => {
    // Store user type in session
    req.session = req.session || {};
    (req.session as any).userType = 'patient';
    
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: 'patient' // Pass user type in state parameter
    })(req, res, next);
});

// Google OAuth callback
router.get('/google/callback', 
    passport.authenticate('google', { session: false }),
    async (req: Request, res: Response) => {
        try {
            const user = req.user as any;
            
            if (!user) {
                return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Authentication failed`);
            }

            // Get user type from state parameter or session
            const userType = req.query.state as string || (req.session as any)?.userType || 'patient';
            
            if (!['doctor', 'patient'].includes(userType)) {
                return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Invalid user type`);
            }

            // Handle Google authentication
            const result = await handleGoogleAuth(
                user.googleId,
                user.email,
                user.name,
                userType as 'doctor' | 'patient'
            );

            if (!result.success) {
                return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=${encodeURIComponent(result.message || 'Authentication failed')}`);
            }

            // Successful authentication - redirect with token and additional info
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const redirectUrl = `${frontendUrl}/callback?token=${result.token}&userType=${userType}&redirectTo=${encodeURIComponent(result.redirectTo || '/dashboard')}&isNewUser=${result.isNewUser}&isReturningIncompleteUser=${result.isReturningIncompleteUser || false}`;
            
            return res.redirect(redirectUrl);

        } catch (error) {
            console.error('Google callback error:', error);
            return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Authentication failed`);
        }
    }
);

// Manual Google auth endpoint (for mobile/API usage)
router.post('/google/verify', async (req: Request, res: Response) => {
    try {
        const { googleToken, userType } = req.body;

        if (!googleToken || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Google token and user type are required',
                error: 'MISSING_FIELDS'
            });
        }

        if (!['doctor', 'patient'].includes(userType)) {
            return res.status(400).json({
                success: false,
                message: 'User type must be either "doctor" or "patient"',
                error: 'INVALID_USER_TYPE'
            });
        }

        // Verify Google token
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${googleToken}`);
        
        if (!response.ok) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Google token',
                error: 'INVALID_GOOGLE_TOKEN'
            });
        }

        const googleUser = await response.json();
        
        if (!googleUser.email) {
            return res.status(400).json({
                success: false,
                message: 'No email found in Google profile',
                error: 'NO_EMAIL_IN_PROFILE'
            });
        }

        // Handle Google authentication
        const result = await handleGoogleAuth(
            googleUser.id,
            googleUser.email,
            googleUser.name,
            userType
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.message,
                error: result.error
            });
        }

        return res.status(200).json({
            success: true,
            message: result.isNewUser ? 'Account created successfully with Google' : 
                    result.isReturningIncompleteUser ? 'Welcome back! Please complete your profile' : 
                    'Login successful',
            data: {
                userId: result.user?.id,
                token: result.token,
                email: result.user?.email,
                name: result.user?.name,
                userType,
                isNewUser: result.isNewUser,
                isReturningIncompleteUser: result.isReturningIncompleteUser || false,
                redirectTo: result.redirectTo || '/dashboard',
                onboardingStep: result.user?.onboardingStep
            }
        });

    } catch (error) {
        console.error('Google verify error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during Google authentication',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
});

export default router;