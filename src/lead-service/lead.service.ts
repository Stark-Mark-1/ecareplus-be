
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import { NOT_FOUND, INTERNAL_SERVER_ERROR } from '../utils/httpStatusCodes';
import * as emailService from '../email-service/email.service';

export const registerProfileView = async (doctorId: string, patientId: string) => {
    try {
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor) throw new AppError('Doctor not found', NOT_FOUND);

        await prisma.doctor.update({
            where: { id: doctorId },
            data: { viewCount: { increment: 1 } }
        });

        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) return; 
        
        const existingLead = await prisma.lead.findUnique({
            where: { doctorId_patientId: { doctorId, patientId } }
        });

        const now = new Date();
        let shouldSendEmail = true;

        if (!existingLead) {
            await prisma.lead.create({
                data: { doctorId, patientId, viewedAt: now }
            });
            shouldSendEmail = true;
        } else {
            const lastViewed = new Date(existingLead.viewedAt);
            const hoursSinceLastView = (now.getTime() - lastViewed.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastView >= 24) shouldSendEmail = true;

            await prisma.lead.update({
                where: { id: existingLead.id },
                data: { viewedAt: now }
            });
        }

        if (shouldSendEmail) {
            console.log(`[LeadService] Sending email to ${doctor.email} for lead from ${patient.name}`);
            const subject = existingLead ? 'Patient Re-visited Your Profile' : 'New Patient Lead';
            const html = `
                <p>Patient ${patient.name} (${patient.gender}, ${patient.age}) viewed your profile.</p>
                <p>Location: ${patient.city}</p>
            `;
            const sent = await emailService.sendEmail(doctor.email, subject, html);
            console.log(`[LeadService] Email sent result: ${sent}`);
        } else {
            console.log(`[LeadService] Email NOT sent. Existing lead: ${!!existingLead}.`);
        }
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error processing profile view: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const getLeadsForDoctor = async (doctorId: string) => {
    try {
        return await prisma.lead.findMany({
            where: { doctorId },
            include: { patient: true },
            orderBy: { viewedAt: 'desc' }
        });
    } catch (error: any) {
        throw new AppError('Error fetching leads: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};
