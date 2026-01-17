
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import { BAD_REQUEST, NOT_FOUND, INTERNAL_SERVER_ERROR } from '../utils/httpStatusCodes';
import * as emailService from '../email-service/email.service';
import { AppointmentStatus } from '@prisma/client';

export const scheduleAppointment = async (doctorId: string, patientId: string, scheduledAt: string, meetingLink: string) => {
    try {
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });

        if (!doctor || !patient) {
            throw new AppError('Doctor or Patient not found', NOT_FOUND);
        }

        const appointmentDate = new Date(scheduledAt);
        if (isNaN(appointmentDate.getTime())) {
            throw new AppError('Invalid date format', BAD_REQUEST);
        }

        const appointment = await prisma.appointment.create({
            data: {
                doctorId,
                patientId,
                scheduledAt: appointmentDate,
                meetingLink,
                status: AppointmentStatus.PENDING
            }
        });

        // Send confirmation emails
        const doctorHtml = `
            <p>You have a new appointment scheduled with ${patient.name}.</p>
            <p>Date: ${appointmentDate.toLocaleString()}</p>
            <p>Meeting Link: <a href="${meetingLink}">${meetingLink}</a></p>
        `;
        await emailService.sendEmail(doctor.email, 'New Appointment Scheduled', doctorHtml);

        const patientHtml = `
            <p>Your appointment with Dr. ${doctor.name} has been scheduled.</p>
            <p>Date: ${appointmentDate.toLocaleString()}</p>
            <p>Meeting Link: <a href="${meetingLink}">${meetingLink}</a></p>
        `;
        await emailService.sendEmail(patient.email, 'Appointment Confirmation', patientHtml);

        return appointment;
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error scheduling appointment: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const getDoctorAppointments = async (doctorId: string) => {
    try {
        return await prisma.appointment.findMany({
            where: { doctorId },
            include: { patient: true },
            orderBy: { scheduledAt: 'asc' }
        });
    } catch (error: any) {
        throw new AppError('Error fetching appointments: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const getPatientAppointments = async (patientId: string) => {
    try {
        return await prisma.appointment.findMany({
            where: { patientId },
            include: { doctor: true },
            orderBy: { scheduledAt: 'asc' }
        });
    } catch (error: any) {
        throw new AppError('Error fetching appointments: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};
