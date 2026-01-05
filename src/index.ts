import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import passport from './services/googleAuth.service';
import doctorRoutes from './routes/doctor.routes';
import patientRoutes from './routes/patient.routes';
import authRoutes from './routes/auth.routes';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

// Session configuration (required for Passport)
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // Allow all origins in development, set specific URL in production
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/auth', authRoutes); // Google OAuth routes
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
