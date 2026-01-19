
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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #2D3748; padding: 20px; text-align: center;">
                        <h2 style="color: #ffffff; margin: 0;">New Patient Lead</h2>
                    </div>
                    <div style="padding: 20px; background-color: #f9fafb;">
                        <p style="font-size: 16px; color: #4a5568;">Hello Dr. ${doctor.name},</p>
                        <p style="font-size: 16px; color: #4a5568;">A patient has just viewed your profile on ECare+. Here are their details:</p>
                        
                        <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 15px;">
                            <h3 style="color: #2d3748; margin-top: 0; border-bottom: 1px solid #edf2f7; padding-bottom: 10px;">Patient Information</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-weight: bold; width: 40%;">Name:</td>
                                    <td style="padding: 8px 0; color: #2d3748;">${patient.name}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-weight: bold;">Age / Gender:</td>
                                    <td style="padding: 8px 0; color: #2d3748;">${patient.age} / ${patient.gender}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-weight: bold;">Location:</td>
                                    <td style="padding: 8px 0; color: #2d3748;">${patient.city}, ${patient.state || ''}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-weight: bold;">Phone:</td>
                                    <td style="padding: 8px 0; color: #2d3748;">${patient.phone || 'Not provided'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-weight: bold;">Email:</td>
                                    <td style="padding: 8px 0; color: #2d3748;">${patient.email}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="margin-top: 25px; text-align: center;">
                            <a href="${process.env.FRONTEND_URL || '#'}/doctor/leads" style="background-color: #4299e1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Full Profile</a>
                        </div>
                    </div>
                    <div style="background-color: #edf2f7; padding: 15px; text-align: center; font-size: 12px; color: #718096;">
                        &copy; ${new Date().getFullYear()} ECare+. All rights reserved.
                    </div>
                </div>
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
