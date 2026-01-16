import { Router } from 'express';
import { onboardingAuth, onboardingPersonalInfo, onboardingProfessionalInfo, onboardingAvailability, verifyOtp, login, fetchAll, fetchById, viewDoctorProfile, getLeads , forgotPassword, verifyResetOtp, resetPassword} from '../controllers/doctor.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

// Onboarding routes
router.post('/onboarding/auth', onboardingAuth); // Email OTP or Google Auth
router.post('/onboarding/verify-otp', verifyOtp); // Verify OTP
router.post('/onboarding/personal-info', authenticateJWT, onboardingPersonalInfo); // Name, Age, Gender, Language, Phone Number
router.post('/onboarding/professional-info', authenticateJWT, onboardingProfessionalInfo); // Specialty, Years of Experience, Recent Grad
router.post('/onboarding/availability', authenticateJWT, onboardingAvailability); // Location (address, city, locality), Available Days, Timing

// Auth and fetch routes
router.post('/login', login); // Login with email and password
router.post('/forgot-password',forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);
router.get('/', fetchAll); // Fetch all doctors
router.get('/:id/leads', authenticateJWT, getLeads); // Get all patients who viewed doctor's profile (must come before /:id)
router.get('/:id', fetchById); // Fetch doctor by ID
router.post('/:id/view', viewDoctorProfile); // View doctor profile (increments view count)

export default router;
