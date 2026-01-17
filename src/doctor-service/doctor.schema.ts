
import { z } from 'zod';
import { Gender, DayOfWeek } from '@prisma/client';

export const onboardingPersonalInfoSchema = z.object({
    body: z.object({
        doctorId: z.string().uuid(),
        name: z.string().min(2),
        age: z.number().min(18).max(100),
        gender: z.nativeEnum(Gender),
        languages: z.array(z.string()).min(1),
        contactNumber: z.string().min(10),
        whatsappNumber: z.string().min(10),
    }),
});

export const onboardingProfessionalInfoSchema = z.object({
    body: z.object({
        doctorId: z.string().uuid(),
        specialty: z.string().min(2),
        yearsOfExperience: z.number().min(0).max(50),
        latestQualification: z.string().min(2),
    }),
});

export const onboardingAvailabilitySchema = z.object({
    body: z.object({
        doctorId: z.string().uuid(),
        address: z.string().min(5),
        city: z.string().min(2),
        locality: z.string().optional(),
        state: z.string().optional(),
        availableDays: z.array(z.nativeEnum(DayOfWeek)).min(1),
        availableTiming: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
    }),
});
