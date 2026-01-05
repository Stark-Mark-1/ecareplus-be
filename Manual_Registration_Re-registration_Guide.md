# Manual Registration with Re-registration Support

## Overview

The manual registration system now supports re-registration for incomplete users, similar to the Google OAuth flow. This allows users who didn't complete their onboarding to register again with the same email.

## Updated Flow Logic

### For Doctors

#### Scenario 1: New User
```
POST /doctors/onboarding/auth
{
  "email": "new@example.com",
  "password": "Password123"
}
```
- Creates new account
- Sends OTP for verification
- Response includes `isReturningIncompleteUser: false`

#### Scenario 2: Returning Incomplete User
```
POST /doctors/onboarding/auth
{
  "email": "incomplete@example.com",  // Email of incomplete user
  "password": "NewPassword123"        // Can be different password
}
```
- Finds existing incomplete account (onboardingStep !== COMPLETE)
- Updates password and generates new OTP
- Resets onboardingStep to EMAIL_VERIFIED
- Sends "Welcome back" email with new OTP
- Response includes `isReturningIncompleteUser: true`

#### Scenario 3: Complete User
```
POST /doctors/onboarding/auth
{
  "email": "complete@example.com",    // Email of complete user
  "password": "Password123"
}
```
- Finds existing complete account
- Returns error: "An account with this email already exists and is fully registered. Please use the login option."
- Error code: `EMAIL_ALREADY_EXISTS_COMPLETE`

### For Patients

#### Scenario 1: New User
```
POST /patients/onboarding/auth
{
  "email": "new@example.com",
  "password": "Password123"
}
```
- Creates new account
- Sends OTP for verification
- Response includes `isReturningIncompleteUser: false`

#### Scenario 2: Returning Incomplete User
```
POST /patients/onboarding/auth
{
  "email": "incomplete@example.com",  // Email of incomplete user
  "password": "NewPassword123"        // Can be different password
}
```
- Finds existing incomplete account (missing name, phone, or city)
- Updates password and generates new OTP
- Resets onboardingStep to EMAIL_VERIFIED
- Sends "Welcome back" email with new OTP
- Response includes `isReturningIncompleteUser: true`

#### Scenario 3: Complete User
```
POST /patients/onboarding/auth
{
  "email": "complete@example.com",    // Email of complete user
  "password": "Password123"
}
```
- Finds existing complete account
- Returns error: "An account with this email already exists and is fully registered. Please use the login option."
- Error code: `EMAIL_ALREADY_EXISTS_COMPLETE`

## API Response Examples

### New User Registration Success
```json
{
  "success": true,
  "message": "Account created successfully. Verification code sent to your email.",
  "data": {
    "doctorId": "uuid-here",
    "isReturningIncompleteUser": false
  }
}
```

### Returning Incomplete User Success
```json
{
  "success": true,
  "message": "Welcome back! Account updated successfully. Verification code sent to your email.",
  "data": {
    "doctorId": "uuid-here",
    "isReturningIncompleteUser": true
  }
}
```

### Complete User Error
```json
{
  "success": false,
  "message": "An account with this email already exists and is fully registered. Please use the login option.",
  "error": "EMAIL_ALREADY_EXISTS_COMPLETE"
}
```

## Email Templates

### New User Email
```html
<h2>ECare+ Verification Code</h2>
<p>Your verification code is:</p>
<h1>123456</h1>
<p>This code will expire in 10 minutes.</p>
```

### Returning Incomplete User Email
```html
<h2>Welcome Back to ECare+!</h2>
<p>We noticed you didn't complete your registration. Let's finish setting up your profile.</p>
<p>Your verification code is:</p>
<h1>123456</h1>
<p>This code will expire in 10 minutes.</p>
```

## Completion Criteria

### Doctor Completion Check
A doctor is considered complete when:
```javascript
doctor.onboardingStep === OnboardingStep.COMPLETE
```

### Patient Completion Check
A patient is considered complete when:
```javascript
patient.name && patient.phone && patient.city
```

## Frontend Integration

### Registration Form Handling
```javascript
const handleRegistration = async (email, password, userType) => {
  try {
    const response = await fetch(`/api/${userType}s/onboarding/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      if (data.data.isReturningIncompleteUser) {
        showMessage('Welcome back! Please verify your email to continue.', 'info');
      } else {
        showMessage('Account created! Please check your email for verification code.', 'success');
      }
      
      // Redirect to OTP verification
      redirectToOTPVerification(email, userType);
    } else {
      if (data.error === 'EMAIL_ALREADY_EXISTS_COMPLETE') {
        showMessage('Account already exists. Please login instead.', 'error');
        redirectToLogin();
      } else {
        showMessage(data.message, 'error');
      }
    }
  } catch (error) {
    showMessage('Registration failed. Please try again.', 'error');
  }
};
```

### User Experience Flow
```
1. User enters email/password
2. Click "Register"
3. System checks if email exists:
   - New email → Create account → Send OTP
   - Incomplete user → Update account → Send "Welcome back" OTP
   - Complete user → Show error → Suggest login
4. User verifies OTP
5. Continue with onboarding or redirect to dashboard
```

## Testing Scenarios

### Test Case 1: New User Registration
1. Use a new email address
2. Register with email/password
3. Verify OTP is sent
4. Complete onboarding flow

### Test Case 2: Incomplete User Re-registration
1. Create incomplete user (register but don't complete onboarding)
2. Try to register again with same email
3. Verify "Welcome back" message and new OTP
4. Complete onboarding flow

### Test Case 3: Complete User Registration Attempt
1. Create complete user (full onboarding done)
2. Try to register again with same email
3. Verify error message suggesting login
4. Use login endpoint instead

### Test Case 4: Password Update for Incomplete User
1. Create incomplete user with password "Old123"
2. Re-register with same email but password "New123"
3. Verify password is updated
4. Login with new password works

## Security Considerations

1. **Password Updates**: Incomplete users can update their password during re-registration
2. **OTP Reset**: New OTP is generated for each re-registration attempt
3. **Onboarding Reset**: Incomplete users get reset to EMAIL_VERIFIED step
4. **Complete User Protection**: Complete users cannot be overwritten via registration

## Error Handling

### Common Error Codes
- `MISSING_FIELDS`: Email or password missing
- `INVALID_EMAIL`: Email format invalid
- `INVALID_PASSWORD`: Password doesn't meet requirements
- `EMAIL_ALREADY_EXISTS_COMPLETE`: Complete user exists, use login
- `EMAIL_SEND_FAILED`: OTP email couldn't be sent
- `INTERNAL_SERVER_ERROR`: Server error

### Error Response Format
```json
{
  "success": false,
  "message": "Human readable error message",
  "error": "ERROR_CODE"
}
```

## Development Testing

Use the provided `test_manual_registration.html` file to test all scenarios:

1. Open the test file in browser
2. Test new user registration
3. Test incomplete user re-registration
4. Test complete user registration attempt
5. Verify OTP verification flow
6. Test login functionality

This ensures both manual and Google OAuth registration flows work consistently with re-registration support for incomplete users.