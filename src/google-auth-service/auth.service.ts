
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OnboardingStep, PatientOnboardingStep } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import { INTERNAL_SERVER_ERROR } from '../utils/httpStatusCodes';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string) => {
    return await bcrypt.compare(password, hash);
};

export const generateToken = (id: string, email: string, type: 'doctor' | 'patient') => {
    const payload: any = { id, email, type };
    if (type === 'doctor') payload.doctorId = id;
    if (type === 'patient') payload.patientId = id;
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const handleGoogleAuth = async (googleId: string, email: string, name: string, userType: 'doctor' | 'patient') => {
    try {
        if (userType === 'doctor') {
            let doctor = await prisma.doctor.findUnique({
                where: { googleId } as any
            });

            if (doctor) {
                const isOnboardingComplete = doctor.onboardingStep === OnboardingStep.COMPLETE;
                const token = generateToken(doctor.id, doctor.email, 'doctor');
                
                return {
                    success: true,
                    isNewUser: false,
                    isReturningIncompleteUser: !isOnboardingComplete,
                    user: doctor,
                    token,
                    redirectTo: isOnboardingComplete ? '/dashboard' : '/onboarding'
                };
            }

            doctor = await prisma.doctor.findUnique({
                where: { email }
            });

            if (doctor) {
                if (doctor.onboardingStep !== OnboardingStep.COMPLETE) {
                    const updatedDoctor = await prisma.doctor.update({
                        where: { email },
                        data: { 
                            googleId,
                            name: name || doctor.name, 
                            onboardingStep: OnboardingStep.PERSONAL_INFO_COMPLETE 
                        } as any
                    });

                    const token = generateToken(updatedDoctor.id, updatedDoctor.email, 'doctor');
                    return {
                        success: true,
                        isNewUser: false,
                        isReturningIncompleteUser: true,
                        user: updatedDoctor,
                        token,
                        redirectTo: '/onboarding'
                    };
                } else {
                    const updatedDoctor = await prisma.doctor.update({
                        where: { email },
                        data: { googleId } as any
                    });

                    const token = generateToken(updatedDoctor.id, updatedDoctor.email, 'doctor');
                    return {
                        success: true,
                        isNewUser: false,
                        isReturningIncompleteUser: false,
                        user: updatedDoctor,
                        token,
                        redirectTo: '/dashboard'
                    };
                }
            }

            const newDoctor = await prisma.doctor.create({
                data: {
                    email,
                    googleId,
                    name,
                    onboardingStep: OnboardingStep.PERSONAL_INFO_COMPLETE 
                } as any
            });

            const token = generateToken(newDoctor.id, newDoctor.email, 'doctor');
            return {
                success: true,
                isNewUser: true,
                isReturningIncompleteUser: false,
                user: newDoctor,
                token,
                redirectTo: '/onboarding'
            };

        } else {
            let patient = await prisma.patient.findUnique({
                where: { googleId } as any
            });

            if (patient) {
                const token = generateToken(patient.id, patient.email, 'patient');
                return {
                    success: true,
                    isNewUser: false,
                    isReturningIncompleteUser: false,
                    user: patient,
                    token,
                    redirectTo: patient.name ? '/patient' : '/patient' 
                };
            }

            patient = await prisma.patient.findUnique({
                where: { email }
            });

            if (patient) {
                const isIncomplete = !patient.name || !patient.phone || !patient.city;
                
                if (isIncomplete) {
                    const updatedPatient = await prisma.patient.update({
                        where: { email },
                        data: { 
                            googleId,
                            name: name || patient.name, 
                            onboardingStep: PatientOnboardingStep.PERSONAL_INFO_COMPLETE
                        } as any
                    });

                    const token = generateToken(updatedPatient.id, updatedPatient.email, 'patient');
                    return {
                        success: true,
                        isNewUser: false,
                        isReturningIncompleteUser: true,
                        user: updatedPatient,
                        token,
                        redirectTo: '/patient'
                    };
                } else {
                    const updatedPatient = await prisma.patient.update({
                        where: { email },
                        data: { googleId } as any
                    });

                    const token = generateToken(updatedPatient.id, updatedPatient.email, 'patient');
                    return {
                        success: true,
                        isNewUser: false,
                        isReturningIncompleteUser: false,
                        user: updatedPatient,
                        token,
                        redirectTo: '/patient'
                    };
                }
            }

            const newPatient = await prisma.patient.create({
                data: {
                    email,
                    googleId,
                    name,
                    onboardingStep: PatientOnboardingStep.PERSONAL_INFO_COMPLETE 
                } as any
            });

            const token = generateToken(newPatient.id, newPatient.email, 'patient');
            return {
                success: true,
                isNewUser: true,
                isReturningIncompleteUser: false,
                user: newPatient,
                token,
                redirectTo: '/patient'
            };
        }
    } catch (error: any) {
        console.error('Google auth handler error:', error);
        if (error instanceof AppError) throw error;
        throw new AppError('Google authentication failed: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};
