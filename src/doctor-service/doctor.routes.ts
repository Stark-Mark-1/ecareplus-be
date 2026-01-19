
import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { FORBIDDEN, NOT_FOUND } from '../utils/httpStatusCodes';
import validate from '../middlewares/validateResource';
import { onboardingPersonalInfoSchema, onboardingProfessionalInfoSchema, onboardingAvailabilitySchema } from './doctor.schema';
import * as doctorService from './doctor.service';
import * as leadService from '../lead-service/lead.service'; // For lead compatibility
import { signupSchema, loginSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema } from '../google-auth-service/auth.schema';
import { Request, Response } from 'express';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/auth.middleware'; // Import Auth Middleware

const router = Router();

// Wrap async functions
// Wrap async functions - using imported asyncHandler

// Auth Routes for Doctor
router.post('/onboarding/auth', validate(signupSchema), asyncHandler(async (req: Request, res: Response) => {
    const { doctor, otp } = await doctorService.createDoctor(req.body);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(201).json({ 
        success: true, 
        message: 'Account created successfully.', 
        data: { 
            doctorId: doctor.id,
            mockOtp: isDev ? otp : undefined 
        } 
    });
}));

router.post('/login', validate(loginSchema), asyncHandler(async (req: Request, res: Response) => {
    const { doctor, token } = await doctorService.loginDoctor(req.body);
    res.json({ 
        success: true, 
        message: 'Login successful',
        data: {
            doctorId: doctor.id,
            token,
            email: doctor.email,
            name: doctor.name,
            onboardingStep: doctor.onboardingStep
        }
    });
}));

router.post('/onboarding/verify-otp', validate(verifyOtpSchema), asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const { doctor, token } = await doctorService.verifyOtp(email, otp);
    res.json({ 
        success: true, 
        message: 'Email verified successfully. You can now proceed with onboarding.',
        data: {
            doctorId: doctor.id,
            token,
            onboardingStep: doctor.onboardingStep
        }
    });
}));


router.post('/onboarding/personal-info', validate(onboardingPersonalInfoSchema), asyncHandler(async (req: Request, res: Response) => {
    const { doctorId, ...data } = req.body;
    const updated = await doctorService.updateDoctorProfile(doctorId, { ...data, onboardingStep: 'PROFESSIONAL_INFO_COMPLETE' }); 
    res.json({ success: true, data: updated });
}));

router.post('/onboarding/professional-info', validate(onboardingProfessionalInfoSchema), asyncHandler(async (req: Request, res: Response) => {
    const { doctorId, ...data } = req.body;
    const updated = await doctorService.updateDoctorProfile(doctorId, { ...data, onboardingStep: 'AVAILABILITY_COMPLETE' }); 
    res.json({ success: true, data: updated });
}));

router.post('/onboarding/availability', validate(onboardingAvailabilitySchema), asyncHandler(async (req: Request, res: Response) => {
    const { doctorId, ...data } = req.body;
    const updated = await doctorService.updateDoctorProfile(doctorId, { ...data, onboardingStep: 'COMPLETE' }); 
    res.json({ success: true, data: updated });
}));

// Auth Routes - Password Reset
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
    const result = await doctorService.forgotPassword(req.body.email);
    res.json({ ...result });
}));

router.post('/verify-reset-otp', validate(verifyOtpSchema), asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const result = await doctorService.verifyResetOtp(email, otp);
    res.json({ success: true, data: result });
}));

router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
    const { email, otp, newPassword } = req.body;
    const result = await doctorService.resetPassword(email, otp, newPassword);
    res.json({ ...result });
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const specialty = req.query.specialty as string | undefined;
    const result = await doctorService.getAllDoctors(page, limit, specialty);
    res.json({ success: true, ...result });
}));
router.get('/:id/leads', authenticateJWT, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
     if (req.user?.type !== 'doctor') throw new AppError('Forbidden', FORBIDDEN);
     const page = parseInt(req.query.page as string) || 1;
     const limit = parseInt(req.query.limit as string) || 10;
     const result = await leadService.getLeadsForDoctor(req.params.id, page, limit);
     res.json({ success: true, ...result });
}));

router.get('/:id',authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
    const doctor = await doctorService.findDoctorById(req.params.id);
    if (!doctor) throw new AppError('Doctor not found', NOT_FOUND);
    res.json({ success: true, data: doctor });
}));

router.post('/:id/view',authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { patientId } = req.body;
    if (patientId) {
        await leadService.registerProfileView(id, patientId);
    }
    res.json({ success: true, message: 'View registered' });
}));

export default router;
