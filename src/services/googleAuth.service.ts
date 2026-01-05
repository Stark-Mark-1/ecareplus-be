
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient, OnboardingStep, PatientOnboardingStep } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// JWT Secret (should be in .env)
const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
}

// Helper functions
const generateJWT = (userId: string, email: string, type: 'doctor' | 'patient'): string => {
    const payload = type === 'doctor' 
        ? { doctorId: userId, email, type: 'doctor' }
        : { patientId: userId, email, type: 'patient' };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

// Configure Google OAuth strategy
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Extract user info from Google profile
            const googleId = profile.id;
            const email = profile.emails?.[0]?.value;
            const name = profile.displayName;

            if (!email) {
                return done(new Error('No email found in Google profile'));
            }

            // Store user info in session/callback for later processing
            const userInfo = {
                googleId,
                email,
                name,
                accessToken
            };

            return done(null, userInfo);
        } catch (error) {
            return done(error);
        }
    }));
}

// Serialize/deserialize user for session
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user: any, done) => {
    done(null, user);
});

// Google OAuth handlers
export const handleGoogleAuth = async (googleId: string, email: string, name: string, userType: 'doctor' | 'patient') => {
    try {
        if (userType === 'doctor') {
            // Check if doctor exists with Google ID
            let doctor = await prisma.doctor.findUnique({
                where: { googleId } as any
            });

            if (doctor) {
                // Existing Google user - check onboarding status
                const isOnboardingComplete = doctor.onboardingStep === OnboardingStep.COMPLETE;
                const token = generateJWT(doctor.id, doctor.email, 'doctor');
                
                return {
                    success: true,
                    isNewUser: false,
                    isReturningIncompleteUser: !isOnboardingComplete,
                    user: doctor,
                    token,
                    redirectTo: isOnboardingComplete ? '/dashboard' : '/onboarding'
                };
            }

            // Check if doctor exists with same email (link accounts or handle incomplete onboarding)
            doctor = await prisma.doctor.findUnique({
                where: { email }
            });

            if (doctor) {
                // Check if onboarding is incomplete - allow re-registration
                if (doctor.onboardingStep !== OnboardingStep.COMPLETE) {
                    // Update existing incomplete account with Google ID and fresh name
                    const updatedDoctor = await prisma.doctor.update({
                        where: { email },
                        data: { 
                            googleId,
                            name: name || doctor.name, // Use Google name if available, otherwise keep existing
                            onboardingStep: OnboardingStep.PERSONAL_INFO_COMPLETE // Reset to allow re-onboarding
                        } as any
                    });

                    const token = generateJWT(updatedDoctor.id, updatedDoctor.email, 'doctor');
                    return {
                        success: true,
                        isNewUser: false,
                        isReturningIncompleteUser: true,
                        user: updatedDoctor,
                        token,
                        redirectTo: '/onboarding'
                    };
                } else {
                    // Complete account - just link Google ID
                    const updatedDoctor = await prisma.doctor.update({
                        where: { email },
                        data: { googleId } as any
                    });

                    const token = generateJWT(updatedDoctor.id, updatedDoctor.email, 'doctor');
                    return {
                        success: true,
                        isNewUser: false,
                        isReturningIncompleteUser: false,
                        user: updatedDoctor,
                        token,
                        redirectTo: '/dashboard'
                    };
                }
            }

            // New Google user - create account
            const newDoctor = await prisma.doctor.create({
                data: {
                    email,
                    googleId,
                    name,
                    onboardingStep: OnboardingStep.PERSONAL_INFO_COMPLETE // Skip email verification for Google users
                } as any
            });

            const token = generateJWT(newDoctor.id, newDoctor.email, 'doctor');
            return {
                success: true,
                isNewUser: true,
                isReturningIncompleteUser: false,
                user: newDoctor,
                token,
                redirectTo: '/onboarding'
            };

        } else {
            // Patient flow
            let patient = await prisma.patient.findUnique({
                where: { googleId } as any
            });

            if (patient) {
                // Existing Google user - patients have simpler onboarding
                const token = generateJWT(patient.id, patient.email, 'patient');
                return {
                    success: true,
                    isNewUser: false,
                    isReturningIncompleteUser: false,
                    user: patient,
                    token,
                    redirectTo: patient.name ? '/dashboard' : '/onboarding' // Check if basic info is complete
                };
            }

            // Check if patient exists with same email (link accounts or handle incomplete onboarding)
            patient = await prisma.patient.findUnique({
                where: { email }
            });

            if (patient) {
                // For patients, if they don't have complete info, allow re-registration
                const isIncomplete = !patient.name || !patient.phone || !patient.city;
                
                if (isIncomplete) {
                    // Update existing incomplete account with Google ID
                    const updatedPatient = await prisma.patient.update({
                        where: { email },
                        data: { 
                            googleId,
                            name: name || patient.name, // Use Google name if available
                            onboardingStep: PatientOnboardingStep.PERSONAL_INFO_COMPLETE
                        } as any
                    });

                    const token = generateJWT(updatedPatient.id, updatedPatient.email, 'patient');
                    return {
                        success: true,
                        isNewUser: false,
                        isReturningIncompleteUser: true,
                        user: updatedPatient,
                        token,
                        redirectTo: '/onboarding'
                    };
                } else {
                    // Complete account - just link Google ID
                    const updatedPatient = await prisma.patient.update({
                        where: { email },
                        data: { googleId } as any
                    });

                    const token = generateJWT(updatedPatient.id, updatedPatient.email, 'patient');
                    return {
                        success: true,
                        isNewUser: false,
                        isReturningIncompleteUser: false,
                        user: updatedPatient,
                        token,
                        redirectTo: '/dashboard'
                    };
                }
            }

            // New Google user - create account
            const newPatient = await prisma.patient.create({
                data: {
                    email,
                    googleId,
                    name,
                    onboardingStep: PatientOnboardingStep.PERSONAL_INFO_COMPLETE // Skip email verification
                } as any
            });

            const token = generateJWT(newPatient.id, newPatient.email, 'patient');
            return {
                success: true,
                isNewUser: true,
                isReturningIncompleteUser: false,
                user: newPatient,
                token,
                redirectTo: '/onboarding'
            };
        }
    } catch (error) {
        console.error('Google auth handler error:', error);
        return {
            success: false,
            error: 'GOOGLE_AUTH_ERROR',
            message: 'An error occurred during Google authentication'
        };
    }
};

export default passport;