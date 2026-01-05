# Testing Google OAuth Implementation

## Setup Required

1. **Environment Variables**: Add these to your `.env` file:
```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
SESSION_SECRET="your-session-secret-change-in-production"
FRONTEND_URL="http://localhost:3000"
```

2. **Google Cloud Console Setup**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select a project
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add `http://localhost:3000/auth/google/callback` to authorized redirect URIs

## Available Endpoints

### 1. Doctor Google Authentication (Web)
```
GET http://localhost:3000/auth/google/doctor
```
- Redirects to Google for authentication
- After success, redirects to: `{FRONTEND_URL}/auth/success?token={JWT}&userType=doctor&redirectTo={/dashboard|/onboarding}&isNewUser={true|false}`

### 2. Patient Google Authentication (Web)
```
GET http://localhost:3000/auth/google/patient
```
- Redirects to Google for authentication
- After success, redirects to: `{FRONTEND_URL}/auth/success?token={JWT}&userType=patient&redirectTo={/dashboard|/onboarding}&isNewUser={true|false}`

### 3. API-based Google Authentication
```
POST http://localhost:3000/auth/google/verify
Content-Type: application/json

{
  "googleToken": "google_access_token_here",
  "userType": "doctor"  // or "patient"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "uuid",
    "token": "jwt_token",
    "email": "user@example.com",
    "name": "User Name",
    "userType": "doctor",
    "isNewUser": false,
    "redirectTo": "/dashboard",
    "onboardingStep": "COMPLETE"
  }
}
```

## Testing Flow

### New User Signup:
1. User visits `/auth/google/doctor` or `/auth/google/patient`
2. Redirected to Google OAuth
3. After Google auth, creates new account
4. Returns JWT token and redirects to onboarding

### Existing User Login:
1. User visits Google OAuth endpoint
2. System finds existing account (by Google ID or email)
3. Links Google account if needed
4. Returns JWT token and redirects to dashboard (if onboarding complete)

### Account Linking:
- If user has existing email account and signs in with Google using same email
- System automatically links Google ID to existing account
- User can now login with either method

## Frontend Integration Examples

### HTML (Simple)
```html
<a href="/auth/google/doctor">Sign in with Google (Doctor)</a>
<a href="/auth/google/patient">Sign in with Google (Patient)</a>
```

### JavaScript (Handle Success)
```javascript
// On your success page, parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const userType = urlParams.get('userType');
const redirectTo = urlParams.get('redirectTo');
const isNewUser = urlParams.get('isNewUser') === 'true';

if (token) {
  // Store token
  localStorage.setItem('authToken', token);
  
  // Redirect user
  if (redirectTo === '/dashboard') {
    window.location.href = '/dashboard';
  } else {
    window.location.href = '/onboarding';
  }
}
```

## Current Server Status
✅ Server running on http://localhost:3000
⚠️ Google OAuth not configured (add credentials to .env)
⚠️ Email service not configured (optional for Google OAuth)

## Next Steps
1. Add Google OAuth credentials to `.env`
2. Test the endpoints
3. Implement frontend success/error pages
4. Handle JWT tokens in your frontend application