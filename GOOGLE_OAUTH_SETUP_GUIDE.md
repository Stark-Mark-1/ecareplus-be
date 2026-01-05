# Google OAuth Setup Guide - Where to Put What

## 🎯 Complete Setup Checklist

### Step 1: Google Cloud Console Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select Project**
   - Click "Select a project" → "New Project"
   - Name: "ECare Plus" (or any name)
   - Click "Create"

3. **Enable Google+ API**
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click on it and press "Enable"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Name: "ECare Plus Web Client"
   
   **CRITICAL - Authorized redirect URIs:**
   ```
   http://localhost:3000/auth/google/callback    (for development)
   https://yourdomain.com/auth/google/callback   (for production)
   ```
   
5. **Copy Credentials**
   - Copy the "Client ID" 
   - Copy the "Client Secret"

### Step 2: Backend Configuration

#### A. Environment Variables (.env file)
```env
# Google OAuth Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID="123456789-abcdefghijklmnop.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-secret-here"

# Backend URLs
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"  # Your backend callback
PORT=3000  # Your backend port

# Frontend URL (where OAuth redirects users after success/error)
FRONTEND_URL="http://localhost:3001"  # Your React/Vue/HTML frontend URL

# Other required configs
JWT_SECRET="your-jwt-secret-key"
SESSION_SECRET="your-session-secret-key"
DATABASE_URL="your-database-url"
```

#### B. Package Dependencies (already installed)
```json
{
  "dependencies": {
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "express-session": "^1.17.3"
  }
}
```

### Step 3: Frontend Setup

#### A. Frontend Environment (.env in your frontend project)
```env
# Point to your backend API
REACT_APP_API_URL="http://localhost:3000"  # Your backend URL
REACT_APP_GOOGLE_CLIENT_ID="123456789-abcdefghijklmnop.apps.googleusercontent.com"  # Same as backend
```

#### B. Frontend Pages Structure
```
src/
├── pages/
│   ├── Login.jsx                    # Main login page with Google buttons
│   ├── auth/
│   │   ├── AuthSuccess.jsx          # Handle /auth/success redirect
│   │   └── AuthError.jsx            # Handle /auth/error redirect
│   ├── onboarding/
│   │   ├── DoctorOnboarding.jsx     # Complete doctor profile
│   │   └── PatientOnboarding.jsx    # Complete patient profile
│   └── Dashboard.jsx                # Main app dashboard
```

#### C. React Router Setup
```jsx
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/success" element={<AuthSuccess />} />
        <Route path="/auth/error" element={<AuthError />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Step 4: Frontend Implementation

#### A. Login Page (src/pages/Login.jsx)
```jsx
import React from 'react';

const Login = () => {
  const API_URL = process.env.REACT_APP_API_URL;

  const handleGoogleAuth = (userType) => {
    // Redirect to backend Google OAuth endpoint
    window.location.href = `${API_URL}/auth/google/${userType}`;
  };

  return (
    <div className="login-page">
      <h1>Welcome to ECare+</h1>
      
      {/* Google OAuth Buttons */}
      <div className="google-auth">
        <button 
          onClick={() => handleGoogleAuth('doctor')}
          className="google-btn doctor"
        >
          🩺 Continue with Google (Doctor)
        </button>
        
        <button 
          onClick={() => handleGoogleAuth('patient')}
          className="google-btn patient"
        >
          👤 Continue with Google (Patient)
        </button>
      </div>
      
      {/* Optional: Manual email/password forms */}
      <div className="manual-auth">
        {/* Your existing email/password forms */}
      </div>
    </div>
  );
};

export default Login;
```

#### B. Success Handler (src/pages/auth/AuthSuccess.jsx)
```jsx
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Extract data from URL parameters
    const token = searchParams.get('token');
    const userType = searchParams.get('userType');
    const redirectTo = searchParams.get('redirectTo');
    const isNewUser = searchParams.get('isNewUser') === 'true';
    const isReturningIncompleteUser = searchParams.get('isReturningIncompleteUser') === 'true';

    if (!token) {
      navigate('/auth/error?message=No token received');
      return;
    }

    // Store authentication data
    localStorage.setItem('authToken', token);
    localStorage.setItem('userType', userType);
    
    // Show appropriate message
    if (isNewUser) {
      alert('Welcome to ECare+! Let\'s complete your profile.');
    } else if (isReturningIncompleteUser) {
      alert('Welcome back! Please complete your profile.');
    } else {
      alert('Welcome back!');
    }

    // Redirect based on completion status
    setTimeout(() => {
      if (redirectTo === '/dashboard') {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    }, 2000);
  }, [navigate, searchParams]);

  return (
    <div className="auth-success">
      <h2>✅ Authentication Successful!</h2>
      <p>Redirecting you...</p>
    </div>
  );
};

export default AuthSuccess;
```

#### C. Error Handler (src/pages/auth/AuthError.jsx)
```jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthError = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const message = searchParams.get('message') || 'Authentication failed';
    setErrorMessage(decodeURIComponent(message));
  }, [searchParams]);

  return (
    <div className="auth-error">
      <h2>❌ Authentication Failed</h2>
      <p>{errorMessage}</p>
      <button onClick={() => navigate('/login')}>
        Try Again
      </button>
    </div>
  );
};

export default AuthError;
```

### Step 5: URL Flow Explanation

#### The Complete Flow:
```
1. User clicks "Continue with Google (Doctor)" on your frontend
   ↓
2. Frontend redirects to: http://localhost:3000/auth/google/doctor
   ↓
3. Backend redirects to: Google OAuth (user authenticates)
   ↓
4. Google redirects to: http://localhost:3000/auth/google/callback
   ↓
5. Backend processes auth and redirects to: 
   http://localhost:3001/auth/success?token=...&userType=doctor&redirectTo=/onboarding
   ↓
6. Frontend AuthSuccess component handles the redirect and stores token
   ↓
7. Frontend redirects to: /dashboard or /onboarding based on user status
```

### Step 6: Testing Setup

#### A. Start Your Servers
```bash
# Backend (in your backend folder)
npm run dev  # Runs on http://localhost:3000

# Frontend (in your frontend folder)  
npm start    # Runs on http://localhost:3001
```

#### B. Test URLs
- **Frontend Login**: http://localhost:3001/login
- **Backend API**: http://localhost:3000
- **Google OAuth Doctor**: http://localhost:3000/auth/google/doctor
- **Google OAuth Patient**: http://localhost:3000/auth/google/patient

#### C. Quick Test (without frontend)
Open `test_manual_registration.html` in your browser and click the Google buttons to test the OAuth flow.

### Step 7: Production Setup

#### A. Update Environment Variables
```env
# Production .env
GOOGLE_CALLBACK_URL="https://api.yourdomain.com/auth/google/callback"
FRONTEND_URL="https://yourdomain.com"
NODE_ENV="production"
```

#### B. Update Google Cloud Console
Add production redirect URI:
```
https://api.yourdomain.com/auth/google/callback
```

### Step 8: Common Issues & Solutions

#### Issue 1: "Google OAuth not configured"
**Solution**: Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file

#### Issue 2: "redirect_uri_mismatch"
**Solution**: Make sure GOOGLE_CALLBACK_URL in .env matches the redirect URI in Google Cloud Console

#### Issue 3: "CORS errors"
**Solution**: Make sure FRONTEND_URL in backend .env matches your frontend URL

#### Issue 4: "Session errors"
**Solution**: Add SESSION_SECRET to your .env file

### Step 9: File Locations Summary

```
Backend Files (already created):
├── src/services/googleAuth.service.ts     ✅ Created
├── src/routes/auth.routes.ts              ✅ Created  
├── src/index.ts                           ✅ Updated
└── .env                                   ⚠️  Add Google credentials

Frontend Files (you need to create):
├── src/pages/Login.jsx                    ❌ Create this
├── src/pages/auth/AuthSuccess.jsx         ❌ Create this
├── src/pages/auth/AuthError.jsx           ❌ Create this
├── src/pages/onboarding/Onboarding.jsx    ❌ Create this
└── .env                                   ❌ Create this

Google Cloud Console:
├── Project created                        ❌ Do this
├── Google+ API enabled                    ❌ Do this
├── OAuth credentials created              ❌ Do this
└── Redirect URIs configured               ❌ Do this
```

### Step 10: Next Actions

1. **Set up Google Cloud Console** (Steps 1-5 above)
2. **Add credentials to backend .env**
3. **Create frontend pages** using the provided code
4. **Test the flow** using the test files
5. **Deploy to production** with HTTPS URLs

That's it! Follow these steps in order and your Google OAuth will work perfectly. 🚀