
import { Router, Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { NOT_FOUND } from '../utils/httpStatusCodes';
import validate from '../middlewares/validateResource';
import { patientPersonalInfoSchema } from './patient.schema';
import * as patientService from './patient.service';
import { signupSchema, loginSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema } from '../google-auth-service/auth.schema';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();
// local asyncHandler removed, using imported one

// Auth Routes for Patient
router.post('/onboarding/auth', validate(signupSchema), asyncHandler(async (req: Request, res: Response) => {
    const { patient, otp } = await patientService.createPatient(req.body);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(201).json({ 
        success: true, 
        message: 'Account created successfully.', 
        data: { 
            patientId: patient.id,
            mockOtp: isDev ? otp : undefined
        } 
    });
}));

router.post('/login', validate(loginSchema), asyncHandler(async (req: Request, res: Response) => {
    const { patient, token } = await patientService.loginPatient(req.body);
    res.json({ 
        success: true, 
        message: 'Login successful',
        data: {
            patientId: patient.id,
            token,
            email: patient.email,
            name: patient.name,
            onboardingStep: patient.onboardingStep
        }
    });
}));

router.post('/onboarding/verify-otp', validate(verifyOtpSchema), asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const { patient, token } = await patientService.verifyOtp(email, otp);
    res.json({ 
        success: true, 
        message: 'Email verified successfully. You can now proceed with onboarding.',
        data: {
            patientId: patient.id,
            token,
            onboardingStep: patient.onboardingStep
        }
    });
}));


router.post('/onboarding/personal-info', validate(patientPersonalInfoSchema), asyncHandler(async (req: Request, res: Response) => {
    const { patientId, ...data } = req.body;
    const updated = await patientService.updatePatientProfile(patientId, { ...data, onboardingStep: 'PERSONAL_INFO_COMPLETE' });
    res.json({ success: true, data: updated });
}));

// Auth Routes - Password Reset
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
    const result = await patientService.forgotPassword(req.body.email);
    res.json({ ...result });
}));

router.post('/verify-reset-otp', validate(verifyOtpSchema), asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const result = await patientService.verifyResetOtp(email, otp);
    res.json({ success: true, data: result });
}));

router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
    const { email, otp, newPassword } = req.body;
    const result = await patientService.resetPassword(email, otp, newPassword);
    res.json({ ...result });
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const patients = await patientService.getAllPatients();
    res.json({ success: true, data: patients });
}));

// Saved Doctors
router.post('/saved-doctors', authenticateJWT, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { doctorId } = req.body;
    // Assuming patientId comes from token or body? Legacy controller would clarify. 
    // Usually token. 
    const patientId = req.user?.id || req.body.patientId; 
    const result = await patientService.saveDoctor(patientId, doctorId);
    res.json({ success: true, data: result });
}));

router.delete('/saved-doctors', authenticateJWT, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { doctorId } = req.body;
    const patientId = req.user?.id || req.body.patientId;
    const result = await patientService.unsaveDoctor(patientId, doctorId);
    res.json({ success: true, data: result });
}));

router.get('/:patientId/saved-doctors', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
    const result = await patientService.getSavedDoctors(req.params.patientId);
    res.json({ success: true, data: result });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientService.findPatientById(req.params.id);
    if (!patient) throw new AppError('Patient not found', NOT_FOUND);
    res.json({ success: true, data: patient });
}));

export default router;
