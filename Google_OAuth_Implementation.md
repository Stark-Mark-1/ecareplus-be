# Google OAuth Implementation Guide

## Overview

This implementation adds Google OAuth authentication to the ECare+ platform, allowing users to sign up or log in using their Google accounts. The system intelligently handles both new user registration and existing user login flows.

## Features

- **Unified Authentication**: Single endpoint handles both signup and login
- **User Type Support**: Separate flows for doctors and patients
- **Account Linking**: Automatically links Google accounts to existing email accounts
- **Smart Routing**: Redirects users based on their onboarding status
- **Mobile Support**: API endpoint for mobile/SPA applications

## API Endpoints

### 1. Web-based Google OAuth (Redirect Flow)

#### Doctor Authentication
```
GET /auth/google/doctor
```
Initiates Google OAuth flow for doctors. Redirects to Google for authentication.

#### Patient Authentication
```
GET /auth/google/patient
```
Initiates Google OAuth flow for patients. Redirects to Google for authentication.

#### OAuth Callback
```
GET /auth/google/callback
```
Handles Google OAuth callback. Automatically processes authentication and redirects to frontend.

**Success Redirect Format:**
```
{FRONTEND_URL}/auth/success?token={JWT_TOKEN}&userType={doctor|patient}&redirectTo={/dashboard|/onboarding}&isNewUser={true|false}
```

**Error Redirect Format:**
```
{FRONTEND_URL}/auth/error?message={ERROR_MESSAGE}
```

### 2. API-based Google OAuth (for Mobile/SPA)

#### Verify Google Token
```
POST /auth/google/verify
```

**Request Body:**
```json
{
  "googleToken": "google_access_token_here",
  "userType": "doctor" // or "patient"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Login successful", // or "Account created successfully with Google"
  "data": {
    "userId": "uuid",
    "token": "jwt_token",
    "email": "user@example.com",
    "name": "User Name",
    "userType": "doctor",
    "isNewUser": false,
    "redirectTo": "/dashboard", // or "/onboarding"
    "onboardingStep": "COMPLETE"
  }
}
```

## Authentication Flow Logic

### For New Users (Signup)
1. User clicks "Sign up with Google"
2. System creates new account with Google ID
3. Sets onboarding step to skip email verification
4. **Doctors**: Redirected to onboarding to complete profile
5. **Patients**: Redirected to onboarding to complete profile

### For Existing Users (Login)
1. User clicks "Login with Google"
2. System finds existing account by Google ID or email
3. If found by email only, links Google ID to account
4. **Doctors**: Redirected to dashboard if onboarding complete, otherwise to onboarding
5. **Patients**: Redirected to dashboard

## Database Schema Changes

### Doctor Model
```prisma
model Doctor {
  id       String @id @default(uuid())
  email    String @unique
  password String? // Optional for Google users
  googleId String? @unique // Google OAuth ID
  // ... other fields
}
```

### Patient Model
```prisma
model Patient {
  id       String @id @default(uuid())
  email    String @unique
  password String? // Optional for Google users
  googleId String? @unique // Google OAuth ID
  // ... other fields
}
```

## Environment Variables

Add these to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"

# Session Secret (required for Passport)
SESSION_SECRET="your-session-secret-change-in-production"

# Frontend URL for redirects
FRONTEND_URL="http://localhost:3000"
```

## Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (development)
   - `https://yourdomain.com/auth/google/callback` (production)
7. Copy Client ID and Client Secret to your `.env` file

## Frontend Integration Examples

### Web Application (Redirect Flow)

```html
<!-- Doctor Signup/Login -->
<a href="/auth/google/doctor" class="google-auth-btn">
  Continue with Google (Doctor)
</a>

<!-- Patient Signup/Login -->
<a href="/auth/google/patient" class="google-auth-btn">
  Continue with Google (Patient)
</a>
```

### Single Page Application (API Flow)

```javascript
// Using Google Sign-In JavaScript library
function handleGoogleSignIn(googleUser, userType) {
  const accessToken = googleUser.getAuthResponse().access_token;
  
  fetch('/auth/google/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      googleToken: accessToken,
      userType: userType // 'doctor' or 'patient'
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Store JWT token
      localStorage.setItem('token', data.data.token);
      
      // Redirect based on response
      if (data.data.redirectTo === '/dashboard') {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/onboarding';
      }
    } else {
      console.error('Authentication failed:', data.message);
    }
  });
}
```

### React Example

```jsx
import { GoogleLogin } from '@react-oauth/google';

function AuthComponent({ userType }) {
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await fetch('/auth/google/verify', {
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
        // Handle successful authentication
        localStorage.setItem('token', data.data.token);
        // Redirect user...
      }
    } catch (error) {
      console.error('Google auth error:', error);
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleGoogleSuccess}
      onError={() => console.log('Login Failed')}
      text={userType === 'doctor' ? 'signin_with' : 'signup_with'}
    />
  );
}
```

## Security Considerations

1. **HTTPS in Production**: Always use HTTPS in production for OAuth callbacks
2. **Secure Sessions**: Session cookies are marked secure in production
3. **Token Validation**: Google tokens are validated server-side
4. **Account Linking**: Existing accounts are safely linked by email verification
5. **JWT Security**: JWTs are signed with a secure secret

## Error Handling

The system handles various error scenarios:

- Invalid Google tokens
- Missing email in Google profile
- Database connection issues
- Account linking conflicts
- Invalid user types

All errors are logged server-side and appropriate error messages are returned to the client.

## Testing

### Manual Testing
1. Set up Google OAuth credentials
2. Start the server: `npm run dev`
3. Navigate to `/auth/google/doctor` or `/auth/google/patient`
4. Complete Google authentication
5. Verify redirect and token generation

### API Testing
Use tools like Postman to test the `/auth/google/verify` endpoint with valid Google access tokens.

## Migration

If you have existing users, they can link their Google accounts by:
1. Logging in with Google using the same email
2. System automatically links the accounts
3. Future logins can use either method

## Troubleshooting

### Common Issues

1. **"Google OAuth not configured"** - Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
2. **"Invalid redirect URI"** - Ensure callback URL matches Google Console settings
3. **Session errors** - Verify SESSION_SECRET is set
4. **CORS issues** - Check FRONTEND_URL and CORS configuration

### Debug Mode

Set `NODE_ENV=development` to enable detailed error logging and debug information.