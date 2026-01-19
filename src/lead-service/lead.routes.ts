
import { Router, Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { FORBIDDEN } from '../utils/httpStatusCodes';
import validate from '../middlewares/validateResource';
import { viewProfileSchema } from './lead.schema';
import * as leadService from './lead.service';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();
// local asyncHandler removed

// View Doctor Profile (Generates Lead)
router.post('/:id/view', validate(viewProfileSchema), asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { patientId } = req.body;
    
   
    if (patientId) {
        await leadService.registerProfileView(id, patientId);
    }
    
    // Return something generic or the doctor if I import DoctorService
    res.json({ success: true, message: 'View registered' });
}));

router.get('/my-leads', authenticateJWT, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Assuming authenticateJWT populates req.user with { doctorId } if it's a doctor
    const doctorId = req.user?.id; // Assuming req.user.id is the doctor ID
    if (!doctorId) throw new AppError('Forbidden', FORBIDDEN);
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await leadService.getLeadsForDoctor(doctorId, page, limit);
    res.json({ success: true, ...result });
}));

export default router;
