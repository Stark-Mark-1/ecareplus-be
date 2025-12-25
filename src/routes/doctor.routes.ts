import { Router } from 'express';
import { onboardingAuth, onboardingPersonalInfo, onboardingProfessionalInfo, onboardingAvailability, verifyOtp, login, fetchAll, fetchById, viewDoctorProfile } from '../controllers/doctor.controller';

const router = Router();

// Onboarding routes
router.post('/onboarding/auth', onboardingAuth); // Email OTP or Google Auth
router.post('/onboarding/verify-otp', verifyOtp); // Verify OTP
router.post('/onboarding/personal-info', onboardingPersonalInfo); // Name, Age, Gender, Language, Phone Number
router.post('/onboarding/professional-info', onboardingProfessionalInfo); // Specialty, Years of Experience, Recent Grad
router.post('/onboarding/availability', onboardingAvailability); // Location (address, city, locality), Available Days, Timing

// Auth and fetch routes
router.post('/login', login); // Login with email and password
router.get('/', fetchAll); // Fetch all doctors
router.get('/:id', fetchById); // Fetch doctor by ID
router.post('/:id/view', viewDoctorProfile); // View doctor profile (increments view count)

export default router;
