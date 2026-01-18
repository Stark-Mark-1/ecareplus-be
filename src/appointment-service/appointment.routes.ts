
import express from 'express';
import * as appointmentService from './appointment.service';
import { authenticateJWT } from '../middlewares/auth.middleware';
import asyncHandler from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { BAD_REQUEST, FORBIDDEN } from '../utils/httpStatusCodes';

const router = express.Router();

router.post('/schedule', authenticateJWT, asyncHandler(async (req: any, res: any) => {
    if (req.user?.type !== 'doctor') {
        throw new AppError('Only doctors can schedule appointments', FORBIDDEN);
    }

    const { patientId, scheduledAt, scheduledEnd, meetingName } = req.body;
    const doctorId = req.user.id;

    if (!patientId || !scheduledAt || !scheduledEnd || !meetingName) {
        throw new AppError('Missing required fields', BAD_REQUEST);
    }

    const appointment = await appointmentService.scheduleAppointment(doctorId, patientId, scheduledAt, scheduledEnd, meetingName);
    res.status(201).json({ success: true, data: appointment });
}));

router.get('/doctor/my-appointments', authenticateJWT, asyncHandler(async (req: any, res: any) => {
    if (req.user?.type !== 'doctor') {
        throw new AppError('Forbidden', FORBIDDEN);
    }
    const appointments = await appointmentService.getDoctorAppointments(req.user.id);
    res.json({ success: true, data: appointments });
}));

router.get('/patient/my-appointments', authenticateJWT, asyncHandler(async (req: any, res: any) => {
    if (req.user?.type !== 'patient') {
        throw new AppError('Forbidden', FORBIDDEN);
    }
    const appointments = await appointmentService.getPatientAppointments(req.user.id);
    res.json({ success: true, data: appointments });
}));

export default router;
