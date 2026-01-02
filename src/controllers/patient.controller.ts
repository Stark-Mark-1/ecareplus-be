import { Request, Response } from 'express';
import { PrismaClient, Gender, PatientOnboardingStep } from '@prisma/client';
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

const generateJWT = (patientId: string, email: string): string => {
    return jwt.sign(
        { patientId, email, type: 'patient' },
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
    return age >= 1 && age <= 120;
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

        // Check if patient already exists
        const existingPatient = await prisma.patient.findUnique({ where: { email } });
        if (existingPatient) {
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

        // Create new patient account
        const patient = await prisma.patient.create({
            data: {
                email,
                password: hashedPassword,
                otp,
                otpExpiry,
                onboardingStep: PatientOnboardingStep.EMAIL_VERIFIED
            },
        });

        // Send Email using Brevo API
        if (!brevoApiInstance) {
            const isDev = process.env.NODE_ENV !== 'production';
            return res.status(200).json({
                success: true,
                message: 'Account created successfully. OTP generated for verification.',
                data: {
                    patientId: patient.id,
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
                        patientId: patient.id,
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
                patientId: patient.id
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

        const patient = await prisma.patient.findUnique({ where: { email } });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Account not found. Please sign up first.',
                error: 'PATIENT_NOT_FOUND'
            });
        }

        if (!patient.otp) {
            return res.status(400).json({
                success: false,
                message: 'No OTP found. Please request a new verification code.',
                error: 'OTP_NOT_FOUND'
            });
        }

        if (patient.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code. Please check and try again.',
                error: 'INVALID_OTP'
            });
        }

        if (patient.otpExpiry && new Date() > patient.otpExpiry) {
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new code.',
                error: 'OTP_EXPIRED'
            });
        }

        // OTP Verified - Update step and generate JWT
        await prisma.patient.update({
            where: { email },
            data: {
                otp: null,
                otpExpiry: null,
                onboardingStep: PatientOnboardingStep.PERSONAL_INFO_COMPLETE
            }
        });

        const token = generateJWT(patient.id, patient.email);

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully. You can now proceed with onboarding.',
            data: {
                patientId: patient.id,
                token,
                onboardingStep: PatientOnboardingStep.PERSONAL_INFO_COMPLETE
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

// Personal Info: Name, Phone, Gender, Age, City
export const onboardingPersonalInfo = async (req: Request, res: Response) => {
    try {
        const { patientId, name, phone, gender, age, city } = req.body;

        // Validation
        if (!patientId || !name || !phone || !gender || !age || !city) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required: name, phone, gender, age, city',
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

        if (!validatePhoneNumber(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number format',
                error: 'INVALID_PHONE'
            });
        }

        if (!Object.values(Gender).includes(gender)) {
            return res.status(400).json({
                success: false,
                message: `Gender must be one of: ${Object.values(Gender).join(', ')}`,
                error: 'INVALID_GENDER'
            });
        }

        const ageNum = Number(age);
        if (isNaN(ageNum) || !validateAge(ageNum)) {
            return res.status(400).json({
                success: false,
                message: 'Age must be between 1 and 120',
                error: 'INVALID_AGE'
            });
        }

        if (typeof city !== 'string' || city.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'City must be at least 2 characters long',
                error: 'INVALID_CITY'
            });
        }

        // Check if patient exists and is at correct step
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient account not found',
                error: 'PATIENT_NOT_FOUND'
            });
        }

        if (patient.onboardingStep !== PatientOnboardingStep.PERSONAL_INFO_COMPLETE) {
            return res.status(400).json({
                success: false,
                message: 'Please complete email verification first',
                error: 'INVALID_ONBOARDING_STEP'
            });
        }

        const updatedPatient = await prisma.patient.update({
            where: { id: patientId },
            data: {
                name: name.trim(),
                phone: phone.trim(),
                gender: gender as Gender,
                age: ageNum,
                city: city.trim()
            },
        });

        return res.status(200).json({
            success: true,
            message: 'Personal information saved successfully. Onboarding complete!',
            data: {
                patientId: updatedPatient.id,
                email: updatedPatient.email,
                name: updatedPatient.name
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

        const patient = await prisma.patient.findUnique({ where: { email } });
        if (!patient) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                error: 'INVALID_CREDENTIALS'
            });
        }

        if (!patient.password) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                error: 'INVALID_CREDENTIALS'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, patient.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                error: 'INVALID_CREDENTIALS'
            });
        }

        const token = generateJWT(patient.id, patient.email);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                patientId: patient.id,
                token,
                email: patient.email,
                name: patient.name,
                onboardingStep: patient.onboardingStep
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

// Fetch all patients
export const fetchAll = async (req: Request, res: Response) => {
    try {
        const patients = await prisma.patient.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                gender: true,
                age: true,
                city: true,
                onboardingStep: true,
                createdAt: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Patients fetched successfully',
            data: patients,
            count: patients.length
        });
    } catch (error) {
        console.error('Fetch all patients error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching patients',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// Fetch patient by ID
export const fetchById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Patient ID is required',
                error: 'MISSING_ID'
            });
        }

        const patient = await prisma.patient.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                gender: true,
                age: true,
                city: true,
                onboardingStep: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found',
                error: 'PATIENT_NOT_FOUND'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Patient fetched successfully',
            data: patient
        });
    } catch (error) {
        console.error('Fetch patient by ID error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching patient',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// UUID validation helper
const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

// Save a doctor
export const saveDoctor = async (req: Request, res: Response) => {
    try {
        const { patientId, doctorId } = req.body;

        if (!patientId || !doctorId) {
            return res.status(400).json({
                success: false,
                message: 'Patient ID and Doctor ID are required',
                error: 'MISSING_FIELDS'
            });
        }

        // Validate UUID format
        if (!isValidUUID(patientId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid patient ID format. Must be a valid UUID.',
                error: 'INVALID_PATIENT_ID_FORMAT'
            });
        }

        if (!isValidUUID(doctorId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid doctor ID format. Must be a valid UUID.',
                error: 'INVALID_DOCTOR_ID_FORMAT'
            });
        }

        // Check if patient exists
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found',
                error: 'PATIENT_NOT_FOUND'
            });
        }

        // Check if doctor exists
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found',
                error: 'DOCTOR_NOT_FOUND'
            });
        }

        // Check if already saved by querying the relation table directly
        const existingRelation = await prisma.$queryRaw<Array<{ A: string; B: string }>>`
            SELECT "A", "B" FROM "_SavedDoctors" 
            WHERE "A" = ${patientId} AND "B" = ${doctorId}
        `;

        if (existingRelation && existingRelation.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Doctor is already saved',
                error: 'DOCTOR_ALREADY_SAVED'
            });
        }

        // Save the doctor using direct insert into relation table (more reliable)
        try {
            await prisma.$executeRaw`
                INSERT INTO "_SavedDoctors" ("A", "B") 
                VALUES (${patientId}, ${doctorId})
                ON CONFLICT ("A", "B") DO NOTHING
            `;
        } catch (prismaError: any) {
            // Handle Prisma foreign key constraint errors
            if (prismaError.code === 'P2003' || prismaError.code === '23503') {
                console.error('Foreign key constraint error:', prismaError);
                // Check which foreign key failed
                const constraint = prismaError.meta?.constraint || prismaError.constraint || '';
                if (constraint.includes('_SavedDoctors_A_fkey') || constraint.includes('A_fkey')) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid patient ID. The patient may not exist or the ID format is incorrect.',
                        error: 'INVALID_PATIENT_ID'
                    });
                } else if (constraint.includes('_SavedDoctors_B_fkey') || constraint.includes('B_fkey')) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid doctor ID. The doctor may not exist or the ID format is incorrect.',
                        error: 'INVALID_DOCTOR_ID'
                    });
                }
            }
            // Re-throw if it's not a foreign key error
            throw prismaError;
        }

        return res.status(200).json({
            success: true,
            message: 'Doctor saved successfully',
            data: {
                patientId,
                doctorId
            }
        });
    } catch (error: any) {
        console.error('Save doctor error:', error);
        
        // Handle specific Prisma errors
        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                message: 'This doctor is already saved by this patient',
                error: 'DOCTOR_ALREADY_SAVED'
            });
        }
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Patient or doctor not found',
                error: 'NOT_FOUND'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: 'An error occurred while saving doctor',
            error: 'INTERNAL_SERVER_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Unsave a doctor
export const unsaveDoctor = async (req: Request, res: Response) => {
    try {
        const { patientId, doctorId } = req.body;

        if (!patientId || !doctorId) {
            return res.status(400).json({
                success: false,
                message: 'Patient ID and Doctor ID are required',
                error: 'MISSING_FIELDS'
            });
        }

        // Check if patient exists
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found',
                error: 'PATIENT_NOT_FOUND'
            });
        }

        // Unsave the doctor
        await prisma.patient.update({
            where: { id: patientId },
            data: {
                savedDoctors: {
                    disconnect: { id: doctorId }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Doctor unsaved successfully',
            data: {
                patientId,
                doctorId
            }
        });
    } catch (error) {
        console.error('Unsave doctor error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while unsaving doctor',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

// Get saved doctors for a patient
export const getSavedDoctors = async (req: Request, res: Response) => {
    try {
        const { patientId } = req.params;

        if (!patientId) {
            return res.status(400).json({
                success: false,
                message: 'Patient ID is required',
                error: 'MISSING_ID'
            });
        }

        // Check if patient exists
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                savedDoctors: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        age: true,
                        gender: true,
                        specialty: true,
                        city: true,
                        locality: true,
                        yearsOfExperience: true,
                        viewCount: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found',
                error: 'PATIENT_NOT_FOUND'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Saved doctors fetched successfully',
            data: patient.savedDoctors,
            count: patient.savedDoctors.length
        });
    } catch (error) {
        console.error('Get saved doctors error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching saved doctors',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
};

