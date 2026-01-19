
import { PrismaClient, Doctor, OnboardingStep, DayOfWeek, Gender } from '@prisma/client';
import prisma from '../config/prisma';
import bcrypt from 'bcrypt';
import { AppError } from '../utils/AppError';
import { BAD_REQUEST, NOT_FOUND, UNAUTHORIZED, CONFLICT, INTERNAL_SERVER_ERROR } from '../utils/httpStatusCodes';
import * as emailService from '../email-service/email.service';
import { generateOTP, generateToken } from '../google-auth-service/auth.service';

export const createDoctor = async (data: any) => {
    try {
        const { email, password } = data;
        const existingDoctor = await prisma.doctor.findUnique({ where: { email } });
        
        if (existingDoctor) {
            if (existingDoctor.onboardingStep !== OnboardingStep.COMPLETE) {
                 const otp = generateOTP();
                 const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
                 const hashedPassword = await bcrypt.hash(password, 10);
                 const updated = await prisma.doctor.update({
                    where: { email },
                    data: { password: hashedPassword, otp, otpExpiry, onboardingStep: OnboardingStep.EMAIL_VERIFIED }
                });
                return { doctor: updated, otp };
            }
            throw new AppError('Email already exists', CONFLICT);
        }

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        const hashedPassword = await bcrypt.hash(password, 10);

        const doctor = await prisma.doctor.create({
            data: {
                email,
                password: hashedPassword,
                otp,
                otpExpiry,
                onboardingStep: OnboardingStep.EMAIL_VERIFIED
            }
        });

        await emailService.sendEmail(email, 'Your Verification Code', `<p>Your OTP is ${otp}</p>`);

        return { doctor, otp };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error creating doctor: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const verifyOtp = async (email: string, otp: string) => {
    try {
        const doctor = await prisma.doctor.findUnique({ where: { email } });
        if (!doctor) throw new AppError('Doctor not found', NOT_FOUND);
        if (!doctor.otp || doctor.otp !== otp) throw new AppError('Invalid OTP', BAD_REQUEST);
        if (doctor.otpExpiry && new Date() > doctor.otpExpiry) throw new AppError('OTP Expired', BAD_REQUEST);

        const updated = await prisma.doctor.update({
            where: { email },
            data: { otp: null, otpExpiry: null, onboardingStep: OnboardingStep.PERSONAL_INFO_COMPLETE }
        });

        const token = generateToken(doctor.id, doctor.email, 'doctor');
        return { doctor: updated, token };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error verifying OTP: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const loginDoctor = async (data: any) => {
    try {
        const { email, password } = data;
        const doctor = await prisma.doctor.findUnique({ where: { email } });
        if (!doctor || !doctor.password) throw new AppError('Invalid credentials', UNAUTHORIZED);

        const isValid = await bcrypt.compare(password, doctor.password);
        if (!isValid) throw new AppError('Invalid credentials', UNAUTHORIZED);

        const token = generateToken(doctor.id, doctor.email, 'doctor');
        return { doctor, token };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error logging in: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const findDoctorByEmail = async (email: string) => {
    try {
        return await prisma.doctor.findUnique({ where: { email } });
    } catch (error: any) {
        throw new AppError('Error finding doctor by email: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const findDoctorById = async (id: string) => {
    try {
        return await prisma.doctor.findUnique({ where: { id } });
    } catch (error: any) {
        throw new AppError('Error finding doctor by ID: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const updateDoctorProfile = async (id: string, data: any) => {
    try {
        return await prisma.doctor.update({
            where: { id },
            data
        });
    } catch (error: any) {
        throw new AppError('Error updating doctor profile: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const getAllDoctors = async (page: number = 1, limit: number = 10) => {
    try {
        const skip = (page - 1) * limit;
        const [doctors, total] = await Promise.all([
            prisma.doctor.findMany({
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    specialty: true,
                    city: true,
                    viewCount: true,
                }
            }),
            prisma.doctor.count()
        ]);

        return {
            data: doctors,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (error: any) {
        throw new AppError('Error fetching doctors: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const forgotPassword = async (email: string) => {
    try {
        const doctor = await prisma.doctor.findUnique({ where: { email } });
        if (!doctor) throw new AppError('Doctor not found', NOT_FOUND);

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.doctor.update({
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
        const doctor = await prisma.doctor.findUnique({ where: { email } });
        if (!doctor) throw new AppError('Doctor not found', NOT_FOUND);
        if (!doctor.otp || doctor.otp !== otp) throw new AppError('Invalid OTP', BAD_REQUEST);
        if (doctor.otpExpiry && new Date() > doctor.otpExpiry) throw new AppError('OTP Expired', BAD_REQUEST);

        return { success: true };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error verifying reset OTP: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const resetPassword = async (email: string, otp: string, newPassword: string) => {
    try {
        const doctor = await prisma.doctor.findUnique({ where: { email } });
        if (!doctor) throw new AppError('Doctor not found', NOT_FOUND);
        if (!doctor.otp || doctor.otp !== otp) throw new AppError('Invalid OTP', BAD_REQUEST);
        if (doctor.otpExpiry && new Date() > doctor.otpExpiry) throw new AppError('OTP Expired', BAD_REQUEST);

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await prisma.doctor.update({
            where: { email },
            data: { password: hashedPassword, otp: null, otpExpiry: null }
        });

        return { success: true, message: 'Password reset successfully' };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error resetting password: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};
