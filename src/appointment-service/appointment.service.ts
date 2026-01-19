
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import { BAD_REQUEST, NOT_FOUND, INTERNAL_SERVER_ERROR } from '../utils/httpStatusCodes';
import * as emailService from '../email-service/email.service';
import { AppointmentStatus } from '@prisma/client';

export const scheduleAppointment = async (doctorId: string, patientId: string, scheduledAt: string, scheduledEnd: string, meetingName: string) => {
    try {
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });

        if (!doctor || !patient) {
            throw new AppError('Doctor or Patient not found', NOT_FOUND);
        }

        const appointmentStart = new Date(scheduledAt);
        const appointmentEnd = new Date(scheduledEnd);

        if (isNaN(appointmentStart.getTime()) || isNaN(appointmentEnd.getTime())) {
            throw new AppError('Invalid date format', BAD_REQUEST);
        }

        const appointment = await prisma.appointment.create({
            data: {
                doctorId,
                patientId,
                scheduledAt: appointmentStart, // Ensure these match schema exactly
                scheduledEnd: appointmentEnd,
                meetingName,
                status: AppointmentStatus.PENDING
            }
        });

        // Send confirmation emails
        const doctorHtml = `
            <p>You have a new appointment scheduled with ${patient.name}.</p>
            <p>Start: ${appointmentStart.toLocaleString()}</p>
            <p>End: ${appointmentEnd.toLocaleString()}</p>
            <p>Meeting Name: ${meetingName}</p>
        `;
        await emailService.sendEmail(doctor.email, 'New Appointment Scheduled', doctorHtml);

        const patientHtml = `
            <p>Your appointment with Dr. ${doctor.name} has been scheduled.</p>
            <p>Start: ${appointmentStart.toLocaleString()}</p>
            <p>End: ${appointmentEnd.toLocaleString()}</p>
            <p>Meeting Name: ${meetingName}</p>
        `;
        await emailService.sendEmail(patient.email, 'Appointment Confirmation', patientHtml);

        return appointment;
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error scheduling appointment: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const getDoctorAppointments = async (doctorId: string, page: number = 1, limit: number = 10) => {
    try {
        const skip = (page - 1) * limit;
        const [appointments, total] = await Promise.all([
            prisma.appointment.findMany({
                where: { doctorId },
                include: { patient: true },
                orderBy: { scheduledAt: 'asc' },
                skip,
                take: limit
            }),
            prisma.appointment.count({ where: { doctorId } })
        ]);

        return {
            data: appointments,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (error: any) {
        throw new AppError('Error fetching appointments: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const getPatientAppointments = async (patientId: string, page: number = 1, limit: number = 10) => {
    try {
        const skip = (page - 1) * limit;
        const [appointments, total] = await Promise.all([
            prisma.appointment.findMany({
                where: { patientId },
                include: { doctor: true },
                orderBy: { scheduledAt: 'asc' },
                skip,
                take: limit
            }),
            prisma.appointment.count({ where: { patientId } })
        ]);

        return {
            data: appointments,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (error: any) {
        throw new AppError('Error fetching appointments: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};
