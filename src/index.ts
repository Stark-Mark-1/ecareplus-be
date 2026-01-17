
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import authRoutes from './google-auth-service/auth.routes';
import doctorRoutes from './doctor-service/doctor.routes';
import patientRoutes from './patient-service/patient.routes';
import leadRoutes from './lead-service/lead.routes';
import './google-auth-service/google.auth';
import globalErrorHandler from './middlewares/globalErrorHandler';
import { AppError } from './utils/AppError';
import appointmentRoutes from './appointment-service/appointment.routes';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
    origin: '*', // Allow all origins in development, set specific URL in production
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/doctors', doctorRoutes);
app.use('/patients', patientRoutes);
app.use('/leads', leadRoutes);
app.use('/appointments', appointmentRoutes);

app.get('/', (req, res) => {
    res.send('ECare+ API is running');
});

// Handle undefined routes
app.all('/(.*)', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
