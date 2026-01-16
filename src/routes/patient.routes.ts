import { Router } from 'express';
import { onboardingAuth, verifyOtp, onboardingPersonalInfo, login, fetchAll, fetchById, saveDoctor, unsaveDoctor, getSavedDoctors, forgotPassword, verifyResetOtp, resetPassword } from '../controllers/patient.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

// Onboarding routes
router.post('/onboarding/auth', onboardingAuth); // Email + Password
router.post('/onboarding/verify-otp', verifyOtp); // Verify OTP
router.post('/onboarding/personal-info', authenticateJWT, onboardingPersonalInfo); // Name, Phone, Gender, Age, City

// Auth and fetch routes
router.post('/login', login); // Login with email and password
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);
router.get('/', fetchAll); // Fetch all patients

// Saved doctors routes (must come before /:id route)
router.post('/saved-doctors', authenticateJWT, saveDoctor); // Save a doctor
router.delete('/saved-doctors', authenticateJWT, unsaveDoctor); // Unsave a doctor
router.get('/:patientId/saved-doctors', authenticateJWT, getSavedDoctors); // Get saved doctors for a patient

router.get('/:id', fetchById); // Fetch patient by ID

export default router;

