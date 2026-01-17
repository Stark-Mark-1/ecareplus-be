
import { z } from 'zod';

export const viewProfileSchema = z.object({
    params: z.object({
        id: z.string().uuid(), // Doctor ID
    }),
    body: z.object({
        patientId: z.string().uuid().optional(),
    }),
});
