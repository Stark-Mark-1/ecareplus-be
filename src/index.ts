import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import doctorRoutes from './routes/doctor.routes';
import patientRoutes from './routes/patient.routes';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // Allow all origins in development, set specific URL in production
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/doctors', doctorRoutes);
app.use('/patients', patientRoutes);

app.get('/', (req, res) => {
    res.send('ECare+ Backend is running');
});

// Patient list stub
app.get('/patients', async (req, res) => {
    try {
        const patients = await prisma.patient.findMany();
        res.json(patients);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
