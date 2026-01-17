
import { z } from 'zod';
import { Gender } from '@prisma/client';

export const patientPersonalInfoSchema = z.object({
    body: z.object({
        patientId: z.string().uuid(),
        name: z.string().min(2),
        phone: z.string().regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Invalid phone format"),
        gender: z.nativeEnum(Gender),
        age: z.number().min(1).max(120),
        city: z.string().min(2),
        state: z.string().min(2),
        issues: z.array(z.string()).optional(),
    }),
});
