import { Request, Response } from 'express';
import { PrismaClient, Gender, OnboardingStep, DayOfWeek } from '@prisma/client';
import * as brevo from '@getbrevo/brevo';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// JWT Secret (should be in .env)
const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

// Brevo API client setup (using HTTP API instead of SMTP to avoid Render blocking)
let brevoApiInstance: brevo.TransactionalEmailsApi | null = null;

const initializeBrevo = () => {
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
        console.warn('⚠️  BREVO_API_KEY not configured. Email sending will be disabled.');
        return null;
    }

    try {
        brevoApiInstance = new brevo.TransactionalEmailsApi();
        // Set API key using the enum for apiKey type
        brevoApiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
        console.log('✅ Brevo API client initialized successfully');
        return brevoApiInstance;
    } catch (error) {
        console.error('❌ Failed to initialize Brevo API:', error);
        return null;
    }
};

initializeBrevo();

// Helper functions
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateJWT = (doctorId: string, email: string): string => {
    return jwt.sign(
        { doctorId, email, type: 'doctor' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );
};

// Validation helpers
const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password: string): { valid: boolean; error?: string } => {
    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one number' };
    }
    return { valid: true };
};

const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
};

const validateAge = (age: number): boolean => {
    return age >= 18 && age <= 100;
};

const validateTiming = (timing: string): boolean => {
    const timingRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timingRegex.test(timing);
};

// Authentication: Email + Password (Required) -> Signup, then OTP is sent
export const onboardingAuth = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
                error: 'MISSING_FIELDS'
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format',
                error: 'INVALID_EMAIL'
            });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                success: false,
                message: passwordValidation.error,
                error: 'INVALID_PASSWORD'
            });
        }

        // Check if doctor already exists
        const existingDoctor = await prisma.doctor.findUnique({ where: { email } });
        if (existingDoctor) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists',
                error: 'EMAIL_ALREADY_EXISTS'
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new doctor account
        const doctor = await prisma.doctor.create({
            data: {
                email,
                password: hashedPassword,
                otp,
                otpExpiry,
                onboardingStep: OnboardingStep.EMAIL_VERIFIED
            },
        });

        // Send Email using Brevo API
        if (!brevoApiInstance) {
            const isDev = process.env.NODE_ENV !== 'production';
            return res.status(200).json({
                success: true,
                message: 'Account created successfully. OTP generated for verification.',
                data: {
                    doctorId: doctor.id,
                    mockOtp: isDev ? otp : undefined
                },
                note: 'Set BREVO_API_KEY environment variable to enable email sending'
            });
        }

        try {
            const sendSmtpEmail = new brevo.SendSmtpEmail();
            sendSmtpEmail.subject = 'Your ECare+ Verification Code';
            sendSmtpEmail.htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4CAF50;">ECare+ Verification Code</h2>
                    <p>Your verification code is:</p>
                    <h1 style="color: #2196F3; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                </div>
            `;
            sendSmtpEmail.sender = { 
                name: 'ECare+', 
                email: process.env.EMAIL_USER || 'noreply@ecareplus.com' 
            };
            sendSmtpEmail.to = [{ email }];

            await brevoApiInstance.sendTransacEmail(sendSmtpEmail);
            console.log(`✅ OTP email sent successfully to ${email}`);
        } catch (emailError: any) {
            console.error('❌ Email send error:', emailError);
            // Return OTP in response if email fails (for development/testing)
            const isDev = process.env.NODE_ENV !== 'production' || process.env.ALLOW_MOCK_OTP === 'true';
            if (isDev) {
                return res.status(200).json({
                    success: true,
                    message: 'Account created. OTP generated (email failed)',
                    data: {
                        doctorId: doctor.id,
                        mockOtp: otp
                    },
                    warning: 'Email service is not configured properly. Please set up BREVO_API_KEY environment variable.'
                });
            }
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification email. Please try again later.',
                error: 'EMAIL_SEND_FAILED'
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Account created successfully. Verification code sent to your email.',
            data: {
                doctorId: doctor.id
            }
        });
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during account creation',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// Verify OTP
export const verifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required',
                error: 'MISSING_FIELDS'
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format',
                error: 'INVALID_EMAIL'
            });
        }

        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: 'OTP must be a 6-digit number',
                error: 'INVALID_OTP_FORMAT'
            });
        }

        const doctor = await prisma.doctor.findUnique({ where: { email } });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Account not found. Please sign up first.',
                error: 'DOCTOR_NOT_FOUND'
            });
        }

        if (!doctor.otp) {
            return res.status(400).json({
                success: false,
                message: 'No OTP found. Please request a new verification code.',
                error: 'OTP_NOT_FOUND'
            });
        }

        if (doctor.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code. Please check and try again.',
                error: 'INVALID_OTP'
            });
        }

        if (doctor.otpExpiry && new Date() > doctor.otpExpiry) {
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new code.',
                error: 'OTP_EXPIRED'
            });
        }

        // OTP Verified - Update step and generate JWT
        await prisma.doctor.update({
            where: { email },
            data: {
                otp: null,
                otpExpiry: null,
                onboardingStep: OnboardingStep.PERSONAL_INFO_COMPLETE
            }
        });

        const token = generateJWT(doctor.id, doctor.email);

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully. You can now proceed with onboarding.',
            data: {
                doctorId: doctor.id,
                token,
                onboardingStep: OnboardingStep.PERSONAL_INFO_COMPLETE
            }
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during verification',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// Personal Info: Name, Age, Gender, Language, Phone Number
export const onboardingPersonalInfo = async (req: Request, res: Response) => {
    try {
        const { doctorId, name, age, gender, languages, contactNumber, whatsappNumber } = req.body;

        // Validation
        if (!doctorId || !name || !age || !gender || !languages || !contactNumber || !whatsappNumber) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required: name, age, gender, languages, contactNumber, whatsappNumber',
                error: 'MISSING_FIELDS'
            });
        }

        if (typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Name must be at least 2 characters long',
                error: 'INVALID_NAME'
            });
        }

        const ageNum = Number(age);
        if (isNaN(ageNum) || !validateAge(ageNum)) {
            return res.status(400).json({
                success: false,
                message: 'Age must be between 18 and 100',
                error: 'INVALID_AGE'
            });
        }

        if (!Object.values(Gender).includes(gender)) {
            return res.status(400).json({
                success: false,
                message: `Gender must be one of: ${Object.values(Gender).join(', ')}`,
                error: 'INVALID_GENDER'
            });
        }

        if (!Array.isArray(languages) || languages.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one language is required',
                error: 'INVALID_LANGUAGES'
            });
        }

        if (!validatePhoneNumber(contactNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact number format',
                error: 'INVALID_CONTACT_NUMBER'
            });
        }

        if (!validatePhoneNumber(whatsappNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid WhatsApp number format',
                error: 'INVALID_WHATSAPP_NUMBER'
            });
        }

        // Check if doctor exists and is at correct step
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor account not found',
                error: 'DOCTOR_NOT_FOUND'
            });
        }

        if (doctor.onboardingStep !== OnboardingStep.PERSONAL_INFO_COMPLETE) {
            return res.status(400).json({
                success: false,
                message: 'Please complete email verification first',
                error: 'INVALID_ONBOARDING_STEP'
            });
        }

        const updatedDoctor = await prisma.doctor.update({
            where: { id: doctorId },
            data: {
                name: name.trim(),
                age: ageNum,
                gender: gender as Gender,
                languages: languages.map((lang: string) => lang.trim()),
                contactNumber: contactNumber.trim(),
                whatsappNumber: whatsappNumber.trim(),
                onboardingStep: OnboardingStep.PROFESSIONAL_INFO_COMPLETE
            },
        });

        return res.status(200).json({
            success: true,
            message: 'Personal information saved successfully',
            data: {
                doctorId: updatedDoctor.id,
                onboardingStep: updatedDoctor.onboardingStep
            }
        });
    } catch (error) {
        console.error('Personal info error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while saving personal information',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// Professional Info: Specialty, Years of Experience, Recent Grad
export const onboardingProfessionalInfo = async (req: Request, res: Response) => {
    try {
        const { doctorId, specialty, yearsOfExperience, latestQualification } = req.body;

        // Validation
        if (!doctorId || !specialty || yearsOfExperience === undefined || !latestQualification) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required: specialty, yearsOfExperience, latestQualification',
                error: 'MISSING_FIELDS'
            });
        }

        if (typeof specialty !== 'string' || specialty.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Specialty must be at least 2 characters long',
                error: 'INVALID_SPECIALTY'
            });
        }

        const yoe = Number(yearsOfExperience);
        if (isNaN(yoe) || yoe < 0 || yoe > 50) {
            return res.status(400).json({
                success: false,
                message: 'Years of experience must be between 0 and 50',
                error: 'INVALID_YEARS_OF_EXPERIENCE'
            });
        }

        if (typeof latestQualification !== 'string' || latestQualification.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Latest qualification must be at least 2 characters long',
                error: 'INVALID_QUALIFICATION'
            });
        }

        // Check if doctor exists and is at correct step
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor account not found',
                error: 'DOCTOR_NOT_FOUND'
            });
        }

        if (doctor.onboardingStep !== OnboardingStep.PROFESSIONAL_INFO_COMPLETE) {
            return res.status(400).json({
                success: false,
                message: 'Please complete personal information first',
                error: 'INVALID_ONBOARDING_STEP'
            });
        }

        const updatedDoctor = await prisma.doctor.update({
            where: { id: doctorId },
            data: {
                specialty: specialty.trim(),
                yearsOfExperience: yoe,
                latestQualification: latestQualification.trim(),
                onboardingStep: OnboardingStep.AVAILABILITY_COMPLETE
            },
        });

        return res.status(200).json({
            success: true,
            message: 'Professional information saved successfully',
            data: {
                doctorId: updatedDoctor.id,
                onboardingStep: updatedDoctor.onboardingStep
            }
        });
    } catch (error) {
        console.error('Professional info error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while saving professional information',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// Availability: Location, Available Days, Timing
export const onboardingAvailability = async (req: Request, res: Response) => {
    try {
        const { doctorId, address, city, locality, availableDays, availableTiming } = req.body;

        // Validation
        if (!doctorId || !address || !city || !locality || !availableDays || !availableTiming) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required: address, city, locality, availableDays, availableTiming',
                error: 'MISSING_FIELDS'
            });
        }

        if (typeof address !== 'string' || address.trim().length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Address must be at least 5 characters long',
                error: 'INVALID_ADDRESS'
            });
        }

        if (typeof city !== 'string' || city.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'City must be at least 2 characters long',
                error: 'INVALID_CITY'
            });
        }

        if (typeof locality !== 'string' || locality.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Locality must be at least 2 characters long',
                error: 'INVALID_LOCALITY'
            });
        }

        if (!Array.isArray(availableDays) || availableDays.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one available day is required',
                error: 'INVALID_AVAILABLE_DAYS'
            });
        }

        // Validate each day
        const validDays = Object.values(DayOfWeek);
        for (const day of availableDays) {
            if (!validDays.includes(day)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid day: ${day}. Must be one of: ${validDays.join(', ')}`,
                    error: 'INVALID_DAY'
                });
            }
        }

        if (!validateTiming(availableTiming)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid timing format. Use format: HH:MM-HH:MM (e.g., 09:00-17:00)',
                error: 'INVALID_TIMING'
            });
        }

        // Check if doctor exists and is at correct step
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor account not found',
                error: 'DOCTOR_NOT_FOUND'
            });
        }

        if (doctor.onboardingStep !== OnboardingStep.AVAILABILITY_COMPLETE) {
            return res.status(400).json({
                success: false,
                message: 'Please complete professional information first',
                error: 'INVALID_ONBOARDING_STEP'
            });
        }

        const updatedDoctor = await prisma.doctor.update({
            where: { id: doctorId },
            data: {
                address: address.trim(),
                city: city.trim(),
                locality: locality.trim(),
                availableDays: availableDays as DayOfWeek[],
                availableTiming: availableTiming.trim(),
                onboardingStep: OnboardingStep.COMPLETE
            },
        });

        return res.status(200).json({
            success: true,
            message: 'Onboarding completed successfully! Welcome to ECare+.',
            data: {
                doctorId: updatedDoctor.id,
                onboardingStep: updatedDoctor.onboardingStep,
                email: updatedDoctor.email,
                name: updatedDoctor.name
            }
        });
    } catch (error) {
        console.error('Availability error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while saving availability information',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// Login: Email + Password
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
                error: 'MISSING_FIELDS'
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format',
                error: 'INVALID_EMAIL'
            });
        }

        const doctor = await prisma.doctor.findUnique({ where: { email } });
        if (!doctor) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                error: 'INVALID_CREDENTIALS'
            });
        }

        if (!doctor.password) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                error: 'INVALID_CREDENTIALS'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, doctor.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                error: 'INVALID_CREDENTIALS'
            });
        }

        const token = generateJWT(doctor.id, doctor.email);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                doctorId: doctor.id,
                token,
                email: doctor.email,
                name: doctor.name,
                onboardingStep: doctor.onboardingStep
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during login',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// Fetch all doctors
export const fetchAll = async (req: Request, res: Response) => {
    try {
        const doctors = await prisma.doctor.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                age: true,
                gender: true,
                specialty: true,
                city: true,
                locality: true,
                viewCount: true,
                onboardingStep: true,
                createdAt: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Doctors fetched successfully',
            data: doctors,
            count: doctors.length
        });
    } catch (error) {
        console.error('Fetch all doctors error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching doctors',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// Fetch doctor by ID
export const fetchById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID is required',
                error: 'MISSING_ID'
            });
        }

        const doctor = await prisma.doctor.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                age: true,
                gender: true,
                languages: true,
                contactNumber: true,
                whatsappNumber: true,
                specialty: true,
                yearsOfExperience: true,
                latestQualification: true,
                address: true,
                city: true,
                locality: true,
                availableDays: true,
                availableTiming: true,
                viewCount: true,
                onboardingStep: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found',
                error: 'DOCTOR_NOT_FOUND'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Doctor fetched successfully',
            data: doctor
        });
    } catch (error) {
        console.error('Fetch doctor by ID error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching doctor',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// View doctor profile (increments view count)
export const viewDoctorProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { patientId } = req.body; // Optional: track which patient viewed

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID is required',
                error: 'MISSING_ID'
            });
        }

        // Check if doctor exists
        const doctor = await prisma.doctor.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                age: true,
                gender: true,
                languages: true,
                contactNumber: true,
                whatsappNumber: true,
                specialty: true,
                yearsOfExperience: true,
                latestQualification: true,
                address: true,
                city: true,
                locality: true,
                availableDays: true,
                availableTiming: true,
                viewCount: true,
                onboardingStep: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found',
                error: 'DOCTOR_NOT_FOUND'
            });
        }

        // Increment view count
        const updatedDoctor = await prisma.doctor.update({
            where: { id },
            data: {
                viewCount: {
                    increment: 1
                }
            },
            select: {
                id: true,
                email: true,
                name: true,
                age: true,
                gender: true,
                languages: true,
                contactNumber: true,
                whatsappNumber: true,
                specialty: true,
                yearsOfExperience: true,
                latestQualification: true,
                address: true,
                city: true,
                locality: true,
                availableDays: true,
                availableTiming: true,
                viewCount: true,
                onboardingStep: true,
                createdAt: true,
                updatedAt: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Doctor profile viewed successfully',
            data: updatedDoctor
        });
    } catch (error) {
        console.error('View doctor profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while viewing doctor profile',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};
