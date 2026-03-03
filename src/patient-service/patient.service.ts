
import { PrismaClient, Patient, PatientOnboardingStep, Gender } from '@prisma/client';
import prisma from '../config/prisma';
import bcrypt from 'bcrypt';
import { AppError } from '../utils/AppError';
import { BAD_REQUEST, NOT_FOUND, UNAUTHORIZED, CONFLICT, INTERNAL_SERVER_ERROR } from '../utils/httpStatusCodes';
import * as emailService from '../email-service/email.service';
import { generateOTP, generateToken } from '../google-auth-service/auth.service';

export const createPatient = async (data: any) => {
    try {
        const { email, password } = data;
        const existingPatient = await prisma.patient.findUnique({ where: { email } });

        if (existingPatient) {
            if (existingPatient.onboardingStep !== PatientOnboardingStep.PERSONAL_INFO_COMPLETE) {
                 const otp = generateOTP();
                 const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
                 const hashedPassword = await bcrypt.hash(password, 10);
                const updated = await prisma.patient.update({
                    where: { email },
                    data: { password: hashedPassword, otp, otpExpiry, onboardingStep: PatientOnboardingStep.EMAIL_VERIFIED }
                });
                return { patient: updated, otp };
            }
            throw new AppError('Email already exists', CONFLICT);
        }

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        const hashedPassword = await bcrypt.hash(password, 10);

        const patient = await prisma.patient.create({
            data: {
                email,
                password: hashedPassword,
                otp,
                otpExpiry,
                onboardingStep: PatientOnboardingStep.EMAIL_VERIFIED
            }
        });

        await emailService.sendEmail(email, 'Your Verification Code', `<p>Your OTP is ${otp}</p>`);

        return { patient, otp };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error creating patient: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const verifyOtp = async (email: string, otp: string) => {
    try {
        const patient = await prisma.patient.findUnique({ where: { email } });
        if (!patient) throw new AppError('Patient not found', NOT_FOUND);
        if (!patient.otp || patient.otp !== otp) throw new AppError('Invalid OTP', BAD_REQUEST);
        if (patient.otpExpiry && new Date() > patient.otpExpiry) throw new AppError('OTP Expired', BAD_REQUEST);

        const updated = await prisma.patient.update({
            where: { email },
            data: { otp: null, otpExpiry: null, onboardingStep: PatientOnboardingStep.PERSONAL_INFO_COMPLETE }
        });

        const token = generateToken(patient.id, patient.email, 'patient');
        return { patient: updated, token };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error verifying OTP: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const loginPatient = async (data: any) => {
    try {
        const { email, password } = data;
        const patient = await prisma.patient.findUnique({ where: { email } });
        if (!patient || !patient.password) throw new AppError('Invalid credentials', UNAUTHORIZED);

        const isValid = await bcrypt.compare(password, patient.password);
        if (!isValid) throw new AppError('Invalid credentials', UNAUTHORIZED);

        const token = generateToken(patient.id, patient.email, 'patient');
        return { patient, token };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error logging in: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};


export const updatePatientProfile = async (id: string, data: any) => {
    try {
        return await prisma.patient.update({
            where: { id },
            data
        });
    } catch (error: any) {
        throw new AppError('Error updating patient profile: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const findPatientByEmail = async (email: string) => {
    try {
        return await prisma.patient.findUnique({ where: { email } });
    } catch (error: any) {
        throw new AppError('Error finding patient by email: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const findPatientById = async (id: string) => {
    try {
        return await prisma.patient.findUnique({ where: { id } });
    } catch (error: any) {
        throw new AppError('Error finding patient by ID: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const getAllPatients = async () => {
    try {
        return await prisma.patient.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                gender: true,
                age: true,
                city: true,
                state: true,
                issues: true,
                onboardingStep: true,
            }
        });
    } catch (error: any) {
        throw new AppError('Error fetching patients: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const forgotPassword = async (email: string) => {
    try {
        const patient = await prisma.patient.findUnique({ where: { email } });
        if (!patient) throw new AppError('Patient not found', NOT_FOUND);

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.patient.update({
            where: { email },
            data: { otp, otpExpiry }
        });

        await emailService.sendEmail(email, 'Reset Password OTP', `<p>Your OTP for password reset is ${otp}</p>`);
        
        return { message: 'OTP sent', otp: process.env.NODE_ENV !== 'production' ? otp : undefined };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error initiating password reset: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const verifyResetOtp = async (email: string, otp: string) => {
    try {
        const patient = await prisma.patient.findUnique({ where: { email } });
        if (!patient) throw new AppError('Patient not found', NOT_FOUND);
        if (!patient.otp || patient.otp !== otp) throw new AppError('Invalid OTP', BAD_REQUEST);
        if (patient.otpExpiry && new Date() > patient.otpExpiry) throw new AppError('OTP Expired', BAD_REQUEST);

        return { success: true };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error verifying reset OTP: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const resetPassword = async (email: string, otp: string, newPassword: string) => {
    try {
        const patient = await prisma.patient.findUnique({ where: { email } });
        if (!patient) throw new AppError('Patient not found', NOT_FOUND);
        if (!patient.otp || patient.otp !== otp) throw new AppError('Invalid OTP', BAD_REQUEST);
        if (patient.otpExpiry && new Date() > patient.otpExpiry) throw new AppError('OTP Expired', BAD_REQUEST);

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await prisma.patient.update({
            where: { email },
            data: { password: hashedPassword, otp: null, otpExpiry: null }
        });

        return { success: true, message: 'Password reset successfully' };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error resetting password: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const saveDoctor = async (patientId: string, doctorId: string) => {
    try {
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        
        if (!patient || !doctor) throw new AppError('Patient or Doctor not found', NOT_FOUND);

        return await prisma.patient.update({
            where: { id: patientId },
            data: {
                savedDoctors: {
                    connect: { id: doctorId }
                }
            }
        });
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error saving doctor: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const unsaveDoctor = async (patientId: string, doctorId: string) => {
    try {
        return await prisma.patient.update({
            where: { id: patientId },
            data: {
                savedDoctors: {
                    disconnect: { id: doctorId }
                }
            }
        });
    } catch (error: any) {
        throw new AppError('Error unsaving doctor: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const getSavedDoctors = async (patientId: string) => {
    try {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                savedDoctors: true 
            }
        });
        
        if (!patient) throw new AppError('Patient not found', NOT_FOUND);
        return patient.savedDoctors;
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error fetching saved doctors: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};
