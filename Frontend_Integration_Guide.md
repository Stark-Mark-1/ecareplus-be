# Complete Frontend Integration Guide

## Overview
This guide shows you exactly where to put your frontend URLs and how to handle the complete Google OAuth flow with re-registration support.

## 1. Environment Configuration

### Backend (.env file)
```env
# Frontend URLs - CRITICAL for redirects
FRONTEND_URL="http://localhost:3000"  # Your frontend base URL
GOOGLE_CALLBACK_URL="http://localhost:8000/auth/google/callback"  # Your backend callback

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Other configs...
JWT_SECRET="your-jwt-secret"
SESSION_SECRET="your-session-secret"
```

### Frontend Environment
```env
# Frontend .env
REACT_APP_API_URL="http://localhost:8000"  # Your backend URL
REACT_APP_GOOGLE_CLIENT_ID="your-google-client-id"  # Same as backend
```

## 2. Complete Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   Google OAuth  │
│   (React/Vue)   │    │   (Node.js)      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. Click "Google"     │                       │
         ├──────────────────────►│                       │
         │                       │ 2. Redirect to Google │
         │                       ├──────────────────────►│
         │                       │                       │
         │                       │ 3. User authenticates │
         │                       │◄──────────────────────┤
         │                       │                       │
         │ 4. Redirect with data │                       │
         │◄──────────────────────┤                       │
         │                       │                       │
         │ 5. Handle success     │                       │
         │                       │                       │
```

## 3. Frontend Pages You Need to Create

### A. Authentication Pages Structure
```
src/
├── pages/
│   ├── auth/
│   │   ├── GoogleAuth.jsx          # Initiate Google OAuth
│   │   ├── AuthSuccess.jsx         # Handle successful auth
│   │   ├── AuthError.jsx           # Handle auth errors
│   │   └── Login.jsx               # Main login page
│   ├── onboarding/
│   │   ├── DoctorOnboarding.jsx    # Doctor profile completion
│   │   └── PatientOnboarding.jsx   # Patient profile completion
│   └── Dashboard.jsx               # Main dashboard
```

### B. URL Routes You Need
```javascript
// React Router example
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/success" element={<AuthSuccess />} />
        <Route path="/auth/error" element={<AuthError />} />
        
        {/* Onboarding Routes */}
        <Route path="/onboarding" element={<Onboarding />} />
        
        {/* Main App */}
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## 4. Frontend Implementation Examples

### A. Login Page with Google OAuth Buttons
```jsx
// src/pages/auth/Login.jsx
import React from 'react';

const Login = () => {
  const handleGoogleAuth = (userType) => {
    // Method 1: Direct redirect (simplest)
    window.location.href = `${process.env.REACT_APP_API_URL}/auth/google/${userType}`;
  };

  return (
    <div className="login-page">
      <h1>Welcome to ECare+</h1>
      
      <div className="auth-buttons">
        <h2>I am a Doctor</h2>
        <button 
          onClick={() => handleGoogleAuth('doctor')}
          className="google-btn doctor-btn"
        >
          <img src="/google-icon.svg" alt="Google" />
          Continue with Google (Doctor)
        </button>
        
        <h2>I am a Patient</h2>
        <button 
          onClick={() => handleGoogleAuth('patient')}
          className="google-btn patient-btn"
        >
          <img src="/google-icon.svg" alt="Google" />
          Continue with Google (Patient)
        </button>
      </div>
      
      {/* Optional: Traditional email/password forms */}
      <div className="traditional-auth">
        <p>Or continue with email</p>
        {/* Your existing email/password forms */}
      </div>
    </div>
  );
};

export default Login;
```

### B. Success Handler Page
```jsx
// src/pages/auth/AuthSuccess.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthSuccess = () => {
      // Extract parameters from URL
      const token = searchParams.get('token');
      const userType = searchParams.get('userType');
      const redirectTo = searchParams.get('redirectTo');
      const isNewUser = searchParams.get('isNewUser') === 'true';
      const isReturningIncompleteUser = searchParams.get('isReturningIncompleteUser') === 'true';

      if (!token) {
        navigate('/auth/error?message=No authentication token received');
        return;
      }

      // Store authentication data
      localStorage.setItem('authToken', token);
      localStorage.setItem('userType', userType);
      
      // Store user context for onboarding
      if (isNewUser || isReturningIncompleteUser) {
        localStorage.setItem('isNewUser', isNewUser.toString());
        localStorage.setItem('isReturningIncompleteUser', isReturningIncompleteUser.toString());
      }

      // Show appropriate message and redirect
      if (isNewUser) {
        // New user - show welcome message
        showMessage('Welcome to ECare+! Let\'s complete your profile.', 'success');
      } else if (isReturningIncompleteUser) {
        // Returning incomplete user
        showMessage('Welcome back! Please complete your profile to continue.', 'info');
      } else {
        // Existing complete user
        showMessage('Welcome back!', 'success');
      }

      // Redirect after short delay
      setTimeout(() => {
        if (redirectTo === '/dashboard') {
          navigate('/dashboard');
        } else {
          navigate('/onboarding');
        }
      }, 2000);
    };

    handleAuthSuccess();
    setLoading(false);
  }, [navigate, searchParams]);

  const showMessage = (message, type) => {
    // Implement your notification system here
    console.log(`${type}: ${message}`);
  };

  if (loading) {
    return (
      <div className="auth-success-page">
        <div className="loading-spinner">
          <h2>Completing authentication...</h2>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-success-page">
      <div className="success-message">
        <h2>✅ Authentication Successful!</h2>
        <p>Redirecting you to the right place...</p>
      </div>
    </div>
  );
};

export default AuthSuccess;
```

### C. Error Handler Page
```jsx
// src/pages/auth/AuthError.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthError = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const message = searchParams.get('message') || 'An unknown error occurred';
    setErrorMessage(decodeURIComponent(message));
  }, [searchParams]);

  return (
    <div className="auth-error-page">
      <div className="error-message">
        <h2>❌ Authentication Failed</h2>
        <p>{errorMessage}</p>
        
        <div className="error-actions">
          <button 
            onClick={() => navigate('/login')}
            className="retry-btn"
          >
            Try Again
          </button>
          
          <button 
            onClick={() => navigate('/')}
            className="home-btn"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthError;
```

### D. Enhanced Onboarding Component
```jsx
// src/pages/onboarding/Onboarding.jsx
import React, { useEffect, useState } from 'react';
import DoctorOnboarding from './DoctorOnboarding';
import PatientOnboarding from './PatientOnboarding';

const Onboarding = () => {
  const [userType, setUserType] = useState(null);
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    const storedUserType = localStorage.getItem('userType');
    const isReturning = localStorage.getItem('isReturningIncompleteUser') === 'true';
    
    setUserType(storedUserType);
    setIsReturningUser(isReturning);
  }, []);

  if (!userType) {
    return <div>Loading...</div>;
  }

  return (
    <div className="onboarding-page">
      {isReturningUser && (
        <div className="welcome-back-banner">
          <h3>👋 Welcome back!</h3>
          <p>Let's finish setting up your profile.</p>
        </div>
      )}
      
      {userType === 'doctor' ? (
        <DoctorOnboarding isReturningUser={isReturningUser} />
      ) : (
        <PatientOnboarding isReturningUser={isReturningUser} />
      )}
    </div>
  );
};

export default Onboarding;
```

## 5. API Integration for Mobile/SPA

### Alternative: Using Google Sign-In JavaScript SDK
```jsx
// For more control, use Google's JavaScript SDK
import { GoogleLogin } from '@react-oauth/google';

const GoogleAuthButton = ({ userType }) => {
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/google/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleToken: credentialResponse.credential,
          userType: userType
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Handle success
        localStorage.setItem('authToken', data.data.token);
        localStorage.setItem('userType', data.data.userType);
        
        if (data.data.isNewUser || data.data.isReturningIncompleteUser) {
          navigate('/onboarding');
        } else {
          navigate('/dashboard');
        }
      } else {
        console.error('Auth failed:', data.message);
      }
    } catch (error) {
      console.error('Google auth error:', error);
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleGoogleSuccess}
      onError={() => console.log('Login Failed')}
      text="signin_with"
    />
  );
};
```

## 6. Backend URL Configuration Summary

### Where Frontend URLs Go:
1. **FRONTEND_URL** in backend `.env` - Used for OAuth redirects
2. **GOOGLE_CALLBACK_URL** in backend `.env` - Google OAuth callback
3. **REACT_APP_API_URL** in frontend `.env` - Backend API base URL

### Redirect Flow:
```
User clicks Google button
↓
Frontend redirects to: /auth/google/doctor or /auth/google/patient
↓
Backend redirects to: Google OAuth
↓
Google redirects to: GOOGLE_CALLBACK_URL (/auth/google/callback)
↓
Backend processes auth and redirects to: FRONTEND_URL/auth/success?params
↓
Frontend handles success and redirects to: /dashboard or /onboarding
```

## 7. User Experience Scenarios

### Scenario 1: New User
1. Clicks "Continue with Google"
2. Completes Google OAuth
3. Lands on `/auth/success` with `isNewUser=true`
4. Redirected to `/onboarding`
5. Completes profile
6. Redirected to `/dashboard`

### Scenario 2: Returning Incomplete User
1. Clicks "Continue with Google"
2. System finds existing incomplete account
3. Lands on `/auth/success` with `isReturningIncompleteUser=true`
4. Redirected to `/onboarding` with welcome back message
5. Completes remaining profile fields
6. Redirected to `/dashboard`

### Scenario 3: Complete User
1. Clicks "Continue with Google"
2. System finds complete account
3. Lands on `/auth/success`
4. Directly redirected to `/dashboard`

## 8. Testing Checklist

- [ ] New doctor signup flow
- [ ] New patient signup flow
- [ ] Returning incomplete doctor
- [ ] Returning incomplete patient
- [ ] Complete user login
- [ ] Error handling (invalid tokens, network issues)
- [ ] Account linking (same email, different auth method)

This complete setup ensures smooth user experience with proper re-registration support and clear frontend integration points.