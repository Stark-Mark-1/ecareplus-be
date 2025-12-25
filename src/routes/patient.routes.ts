import { Router } from 'express';
import { onboardingAuth, verifyOtp, onboardingPersonalInfo, login, fetchAll, fetchById, saveDoctor, unsaveDoctor, getSavedDoctors } from '../controllers/patient.controller';

const router = Router();

// Onboarding routes
router.post('/onboarding/auth', onboardingAuth); // Email + Password
router.post('/onboarding/verify-otp', verifyOtp); // Verify OTP
router.post('/onboarding/personal-info', onboardingPersonalInfo); // Name, Phone, Gender, Age, City

// Auth and fetch routes
router.post('/login', login); // Login with email and password
router.get('/', fetchAll); // Fetch all patients

// Saved doctors routes (must come before /:id route)
router.post('/saved-doctors', saveDoctor); // Save a doctor
router.delete('/saved-doctors', unsaveDoctor); // Unsave a doctor
router.get('/:patientId/saved-doctors', getSavedDoctors); // Get saved doctors for a patient

router.get('/:id', fetchById); // Fetch patient by ID

export default router;

