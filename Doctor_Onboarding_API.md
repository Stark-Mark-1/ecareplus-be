# ECare+ API Documentation

Complete API documentation for ECare+ including Doctor and Patient endpoints.

**Base URL:** `http://localhost:3000`

---

## Table of Contents

- [Doctor Endpoints](#doctor-endpoints)
  - [Onboarding Flow](#doctor-onboarding-flow)
  - [Login](#doctor-login)
  - [Fetch All Doctors](#fetch-all-doctors)
  - [Fetch Doctor by ID](#fetch-doctor-by-id)
  - [View Doctor Profile](#view-doctor-profile)
- [Patient Endpoints](#patient-endpoints)
  - [Onboarding Flow](#patient-onboarding-flow)
  - [Login](#patient-login)
  - [Fetch All Patients](#fetch-all-patients)
  - [Fetch Patient by ID](#fetch-patient-by-id)
  - [Saved Doctors](#saved-doctors)
    - [Save Doctor](#save-doctor)
    - [Unsave Doctor](#unsave-doctor)
    - [Get Saved Doctors](#get-saved-doctors)

---

# Doctor Endpoints

## Doctor Onboarding Flow

The doctor onboarding process consists of 5 sequential steps:

1. **Onboarding Auth** - Create account with email and password
2. **Verify OTP** - Verify email with OTP code
3. **Personal Info** - Submit personal information
4. **Professional Info** - Submit professional information
5. **Availability** - Submit availability and location details

---

## 1. Onboarding Auth

Create a new doctor account with email and password.

**Endpoint:** `POST /doctors/onboarding/auth`

### Request Body

```json
{
  "email": "doctor@example.com",
  "password": "SecurePass123"
}
```

### Validation Rules

- **email**: Must be a valid email format
- **password**: Must meet the following criteria:
  - At least 8 characters long
  - Contains at least one uppercase letter
  - Contains at least one lowercase letter
  - Contains at least one number

### Response

**Success (201 or 200):**

```json
{
  "success": true,
  "message": "Account created successfully. Verification code sent to your email.",
  "data": {
    "doctorId": "uuid-string-here"
  }
}
```

**Dev Mode (if email not configured):**

```json
{
  "success": true,
  "message": "Account created successfully. OTP generated for verification.",
  "data": {
    "doctorId": "uuid-string-here",
    "mockOtp": "123456"
  },
  "note": "Set EMAIL_USER and EMAIL_PASS environment variables to enable email sending"
}
```

**Error (400):**

```json
{
  "success": false,
  "message": "Invalid email format",
  "error": "INVALID_EMAIL"
}
```

```json
{
  "success": false,
  "message": "Password must be at least 8 characters long",
  "error": "INVALID_PASSWORD"
}
```

**Error (409):**

```json
{
  "success": false,
  "message": "An account with this email already exists",
  "error": "EMAIL_ALREADY_EXISTS"
}
```

### Notes

- If an account with the email already exists, a 409 error will be returned
- OTP expires in 10 minutes
- In development mode, if email is not configured, the OTP will be returned in the response
- The `doctorId` returned is a UUID string

---

## 2. Verify OTP

Verify the email address using the OTP code received via email.

**Endpoint:** `POST /doctors/onboarding/verify-otp`

### Request Body

```json
{
  "email": "doctor@example.com",
  "otp": "123456"
}
```

### Validation Rules

- **email**: Must be a valid email format
- **otp**: Must be a 6-digit number

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Email verified successfully. You can now proceed with onboarding.",
  "data": {
    "doctorId": "uuid-string-here",
    "token": "jwt-token-here",
    "onboardingStep": "PERSONAL_INFO_COMPLETE"
  }
}
```

**Error (400):**

```json
{
  "success": false,
  "message": "Invalid verification code. Please check and try again.",
  "error": "INVALID_OTP"
}
```

```json
{
  "success": false,
  "message": "Verification code has expired. Please request a new code.",
  "error": "OTP_EXPIRED"
}
```

### Notes

- The JWT token should be saved and used for subsequent authenticated requests
- After verification, the onboarding step moves to `PERSONAL_INFO_COMPLETE`

---

## 3. Personal Info

Submit personal information about the doctor.

**Endpoint:** `POST /doctors/onboarding/personal-info`

### Request Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```json
{
  "doctorId": "uuid-string-here",
  "name": "Dr. John Doe",
  "age": 35,
  "gender": "MALE",
  "languages": ["English", "Hindi"],
  "contactNumber": "+1234567890",
  "whatsappNumber": "+1234567890"
}
```

### Validation Rules

- **doctorId**: Required (UUID string)
- **name**: Required, at least 2 characters
- **age**: Required, must be between 18 and 100
- **gender**: Required, must be one of: `MALE`, `FEMALE`, `OTHER`, `PREFER_NOT_TO_SAY`
- **languages**: Required, array with at least one language
- **contactNumber**: Required, valid phone number format
- **whatsappNumber**: Required, valid phone number format

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Personal information saved successfully",
  "data": {
    "doctorId": "uuid-string-here",
    "onboardingStep": "PROFESSIONAL_INFO_COMPLETE"
  }
}
```

**Error (400):**

```json
{
  "success": false,
  "message": "Age must be between 18 and 100",
  "error": "INVALID_AGE"
}
```

```json
{
  "success": false,
  "message": "Please complete email verification first",
  "error": "INVALID_ONBOARDING_STEP"
}
```

### Notes

- The doctor must be at `PERSONAL_INFO_COMPLETE` step (after OTP verification)
- After successful submission, the step moves to `PROFESSIONAL_INFO_COMPLETE`

---

## 4. Professional Info

Submit professional information about the doctor.

**Endpoint:** `POST /doctors/onboarding/professional-info`

### Request Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```json
{
  "doctorId": "uuid-string-here",
  "specialty": "Cardiology",
  "yearsOfExperience": 10,
  "latestQualification": "MD in Cardiology"
}
```

### Validation Rules

- **doctorId**: Required (UUID string)
- **specialty**: Required, at least 2 characters
- **yearsOfExperience**: Required, must be between 0 and 50
- **latestQualification**: Required, at least 2 characters

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Professional information saved successfully",
  "data": {
    "doctorId": "uuid-string-here",
    "onboardingStep": "AVAILABILITY_COMPLETE"
  }
}
```

**Error (400):**

```json
{
  "success": false,
  "message": "Years of experience must be between 0 and 50",
  "error": "INVALID_YEARS_OF_EXPERIENCE"
}
```

```json
{
  "success": false,
  "message": "Please complete personal information first",
  "error": "INVALID_ONBOARDING_STEP"
}
```

### Notes

- The doctor must be at `PROFESSIONAL_INFO_COMPLETE` step
- After successful submission, the step moves to `AVAILABILITY_COMPLETE`

---

## 5. Availability

Submit availability and location information. This is the final step of onboarding.

**Endpoint:** `POST /doctors/onboarding/availability`

### Request Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```json
{
  "doctorId": "uuid-string-here",
  "address": "123 Medical Center Drive",
  "city": "New York",
  "locality": "Manhattan",
  "availableDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  "availableTiming": "09:00-17:00"
}
```

### Validation Rules

- **doctorId**: Required (UUID string)
- **address**: Required, at least 5 characters
- **city**: Required, at least 2 characters
- **locality**: Required, at least 2 characters
- **availableDays**: Required, array with at least one day
  - Valid values: `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY`
- **availableTiming**: Required, format: `HH:MM-HH:MM` (e.g., `09:00-17:00`)
  - Must be in 24-hour format
  - Start time must be before end time

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Onboarding completed successfully! Welcome to ECare+.",
  "data": {
    "doctorId": "uuid-string-here",
    "onboardingStep": "COMPLETE",
    "email": "doctor@example.com",
    "name": "Dr. John Doe"
  }
}
```

**Error (400):**

```json
{
  "success": false,
  "message": "Invalid timing format. Use format: HH:MM-HH:MM (e.g., 09:00-17:00)",
  "error": "INVALID_TIMING"
}
```

```json
{
  "success": false,
  "message": "Invalid day: INVALID_DAY. Must be one of: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY",
  "error": "INVALID_DAY"
}
```

```json
{
  "success": false,
  "message": "Please complete professional information first",
  "error": "INVALID_ONBOARDING_STEP"
}
```

### Notes

- The doctor must be at `AVAILABILITY_COMPLETE` step
- After successful submission, onboarding is complete (`COMPLETE` step)

---

## Onboarding Steps

The onboarding process follows these steps in order:

1. `EMAIL_VERIFIED` - After account creation
2. `PERSONAL_INFO_COMPLETE` - After OTP verification
3. `PROFESSIONAL_INFO_COMPLETE` - After personal info submission
4. `AVAILABILITY_COMPLETE` - After professional info submission
5. `COMPLETE` - After availability submission (onboarding finished)

---

## Error Codes

| Error Code | Description |
|------------|-------------|
| `MISSING_FIELDS` | Required fields are missing |
| `MISSING_ID` | ID parameter is missing |
| `INVALID_EMAIL` | Email format is invalid |
| `INVALID_PASSWORD` | Password doesn't meet requirements |
| `EMAIL_ALREADY_EXISTS` | An account with this email already exists |
| `INVALID_CREDENTIALS` | Invalid email or password (login) |
| `INVALID_OTP_FORMAT` | OTP is not a 6-digit number |
| `INVALID_OTP` | OTP doesn't match |
| `OTP_EXPIRED` | OTP has expired |
| `OTP_NOT_FOUND` | No OTP found for the account |
| `DOCTOR_NOT_FOUND` | Doctor account doesn't exist |
| `PATIENT_NOT_FOUND` | Patient account doesn't exist |
| `DOCTOR_ALREADY_SAVED` | Doctor is already saved by the patient |
| `INVALID_ONBOARDING_STEP` | Doctor is not at the correct onboarding step |
| `INVALID_NAME` | Name is too short |
| `INVALID_AGE` | Age is out of valid range (18-100) |
| `INVALID_GENDER` | Gender value is not valid |
| `INVALID_LANGUAGES` | Languages array is empty or invalid |
| `INVALID_CONTACT_NUMBER` | Contact number format is invalid |
| `INVALID_WHATSAPP_NUMBER` | WhatsApp number format is invalid |
| `INVALID_SPECIALTY` | Specialty is too short |
| `INVALID_YEARS_OF_EXPERIENCE` | Years of experience is out of range (0-50) |
| `INVALID_QUALIFICATION` | Qualification is too short |
| `INVALID_ADDRESS` | Address is too short |
| `INVALID_CITY` | City is too short |
| `INVALID_LOCALITY` | Locality is too short |
| `INVALID_AVAILABLE_DAYS` | Available days array is empty |
| `INVALID_DAY` | Day value is not valid |
| `INVALID_TIMING` | Timing format is invalid |
| `EMAIL_SEND_FAILED` | Failed to send email |
| `INTERNAL_SERVER_ERROR` | Server error occurred |

---

## Example Complete Flow

### Step 1: Create Account

```bash
curl -X POST http://localhost:3000/doctors/onboarding/auth \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "password": "SecurePass123"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "doctorId": "550e8400-e29b-41d4-a716-446655440000",
    "mockOtp": "123456"
  }
}
```

### Step 2: Verify OTP

```bash
curl -X POST http://localhost:3000/doctors/onboarding/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "otp": "123456"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "doctorId": "550e8400-e29b-41d4-a716-446655440000",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "onboardingStep": "PERSONAL_INFO_COMPLETE"
  }
}
```

### Step 3: Personal Info

```bash
curl -X POST http://localhost:3000/doctors/onboarding/personal-info \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "doctorId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Dr. John Doe",
    "age": 35,
    "gender": "MALE",
    "languages": ["English", "Hindi"],
    "contactNumber": "+1234567890",
    "whatsappNumber": "+1234567890"
  }'
```

### Step 4: Professional Info

```bash
curl -X POST http://localhost:3000/doctors/onboarding/professional-info \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "doctorId": "550e8400-e29b-41d4-a716-446655440000",
    "specialty": "Cardiology",
    "yearsOfExperience": 10,
    "latestQualification": "MD in Cardiology"
  }'
```

### Step 5: Availability

```bash
curl -X POST http://localhost:3000/doctors/onboarding/availability \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "doctorId": "550e8400-e29b-41d4-a716-446655440000",
    "address": "123 Medical Center Drive",
    "city": "New York",
    "locality": "Manhattan",
    "availableDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    "availableTiming": "09:00-17:00"
  }'
```

---

## Doctor Login

Login with email and password for existing doctors.

**Endpoint:** `POST /doctors/login`

### Request Body

```json
{
  "email": "doctor@example.com",
  "password": "SecurePass123"
}
```

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "doctorId": "uuid-string-here",
    "token": "jwt-token-here",
    "email": "doctor@example.com",
    "name": "Dr. John Doe",
    "onboardingStep": "COMPLETE"
  }
}
```

**Error (401):**

```json
{
  "success": false,
  "message": "Invalid email or password",
  "error": "INVALID_CREDENTIALS"
}
```

---

## Fetch All Doctors

Get a list of all doctors.

**Endpoint:** `GET /doctors`

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Doctors fetched successfully",
  "data": [
    {
      "id": "uuid-string-here",
      "email": "doctor@example.com",
      "name": "Dr. John Doe",
      "age": 35,
      "gender": "MALE",
      "specialty": "Cardiology",
      "city": "New York",
      "locality": "Manhattan",
      "viewCount": 10,
      "onboardingStep": "COMPLETE",
      "createdAt": "2025-12-26T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## Fetch Doctor by ID

Get a specific doctor by their ID.

**Endpoint:** `GET /doctors/:id`

### Path Parameters

- **id** (required): Doctor UUID

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Doctor fetched successfully",
  "data": {
    "id": "uuid-string-here",
    "email": "doctor@example.com",
    "name": "Dr. John Doe",
    "age": 35,
    "gender": "MALE",
    "languages": ["English", "Hindi"],
    "contactNumber": "+1234567890",
    "whatsappNumber": "+1234567890",
    "specialty": "Cardiology",
    "yearsOfExperience": 10,
    "latestQualification": "MD in Cardiology",
    "address": "123 Medical Center Drive",
    "city": "New York",
    "locality": "Manhattan",
    "availableDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    "availableTiming": "09:00-17:00",
    "viewCount": 10,
    "onboardingStep": "COMPLETE",
    "createdAt": "2025-12-26T00:00:00.000Z",
    "updatedAt": "2025-12-26T00:00:00.000Z"
  }
}
```

**Error (404):**

```json
{
  "success": false,
  "message": "Doctor not found",
  "error": "DOCTOR_NOT_FOUND"
}
```

### Notes

- The response includes `viewCount` which shows how many times the doctor's profile has been viewed
- This endpoint does not increment the view count (use View Doctor Profile endpoint for that)

---

## View Doctor Profile

View a doctor's profile and increment the view count. This endpoint should be called when a patient views a doctor's profile.

**Endpoint:** `POST /doctors/:id/view`

### Path Parameters

- **id** (required): Doctor UUID

### Request Body (Optional)

```json
{
  "patientId": "uuid-string-here"
}
```

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Doctor profile viewed successfully",
  "data": {
    "id": "uuid-string-here",
    "email": "doctor@example.com",
    "name": "Dr. John Doe",
    "age": 35,
    "gender": "MALE",
    "languages": ["English", "Hindi"],
    "contactNumber": "+1234567890",
    "whatsappNumber": "+1234567890",
    "specialty": "Cardiology",
    "yearsOfExperience": 10,
    "latestQualification": "MD in Cardiology",
    "address": "123 Medical Center Drive",
    "city": "New York",
    "locality": "Manhattan",
    "availableDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    "availableTiming": "09:00-17:00",
    "viewCount": 15,
    "onboardingStep": "COMPLETE",
    "createdAt": "2025-12-26T00:00:00.000Z",
    "updatedAt": "2025-12-26T00:00:00.000Z"
  }
}
```

**Error (404):**

```json
{
  "success": false,
  "message": "Doctor not found",
  "error": "DOCTOR_NOT_FOUND"
}
```

### Notes

- The `viewCount` is automatically incremented each time this endpoint is called
- The `patientId` in the request body is optional and can be used for analytics/tracking
- Use this endpoint instead of `GET /doctors/:id` when you want to track profile views

---

# Patient Endpoints

## Patient Onboarding Flow

The patient onboarding process consists of 3 sequential steps:

1. **Onboarding Auth** - Create account with email and password
2. **Verify OTP** - Verify email with OTP code
3. **Personal Info** - Submit personal information (name, phone, gender, age, city)

---

## 1. Patient Onboarding Auth

Create a new patient account with email and password.

**Endpoint:** `POST /patients/onboarding/auth`

### Request Body

```json
{
  "email": "patient@example.com",
  "password": "SecurePass123"
}
```

### Validation Rules

- **email**: Must be a valid email format
- **password**: Must meet the following criteria:
  - At least 8 characters long
  - Contains at least one uppercase letter
  - Contains at least one lowercase letter
  - Contains at least one number

### Response

**Success (201 or 200):**

```json
{
  "success": true,
  "message": "Account created successfully. Verification code sent to your email.",
  "data": {
    "patientId": "uuid-string-here"
  }
}
```

**Dev Mode (if email not configured):**

```json
{
  "success": true,
  "message": "Account created successfully. OTP generated for verification.",
  "data": {
    "patientId": "uuid-string-here",
    "mockOtp": "123456"
  },
  "note": "Set EMAIL_USER and EMAIL_PASS environment variables to enable email sending"
}
```

**Error (409):**

```json
{
  "success": false,
  "message": "An account with this email already exists",
  "error": "EMAIL_ALREADY_EXISTS"
}
```

---

## 2. Patient Verify OTP

Verify the email address using the OTP code received via email.

**Endpoint:** `POST /patients/onboarding/verify-otp`

### Request Body

```json
{
  "email": "patient@example.com",
  "otp": "123456"
}
```

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Email verified successfully. You can now proceed with onboarding.",
  "data": {
    "patientId": "uuid-string-here",
    "token": "jwt-token-here",
    "onboardingStep": "PERSONAL_INFO_COMPLETE"
  }
}
```

---

## 3. Patient Personal Info

Submit personal information about the patient.

**Endpoint:** `POST /patients/onboarding/personal-info`

### Request Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```json
{
  "patientId": "uuid-string-here",
  "name": "John Doe",
  "phone": "+1234567890",
  "gender": "MALE",
  "age": 30,
  "city": "New York"
}
```

### Validation Rules

- **patientId**: Required (UUID string)
- **name**: Required, at least 2 characters
- **phone**: Required, valid phone number format
- **gender**: Required, must be one of: `MALE`, `FEMALE`, `OTHER`, `PREFER_NOT_TO_SAY`
- **age**: Required, must be between 1 and 120
- **city**: Required, at least 2 characters

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Personal information saved successfully. Onboarding complete!",
  "data": {
    "patientId": "uuid-string-here",
    "email": "patient@example.com",
    "name": "John Doe"
  }
}
```

---

## Patient Login

Login with email and password for existing patients.

**Endpoint:** `POST /patients/login`

### Request Body

```json
{
  "email": "patient@example.com",
  "password": "SecurePass123"
}
```

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "patientId": "uuid-string-here",
    "token": "jwt-token-here",
    "email": "patient@example.com",
    "name": "John Doe",
    "onboardingStep": "PERSONAL_INFO_COMPLETE"
  }
}
```

**Error (401):**

```json
{
  "success": false,
  "message": "Invalid email or password",
  "error": "INVALID_CREDENTIALS"
}
```

---

## Fetch All Patients

Get a list of all patients.

**Endpoint:** `GET /patients`

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Patients fetched successfully",
  "data": [
    {
      "id": "uuid-string-here",
      "email": "patient@example.com",
      "name": "John Doe",
      "phone": "+1234567890",
      "gender": "MALE",
      "age": 30,
      "city": "New York",
      "onboardingStep": "PERSONAL_INFO_COMPLETE",
      "createdAt": "2025-12-26T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## Fetch Patient by ID

Get a specific patient by their ID.

**Endpoint:** `GET /patients/:id`

### Path Parameters

- **id** (required): Patient UUID

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Patient fetched successfully",
  "data": {
    "id": "uuid-string-here",
    "email": "patient@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "gender": "MALE",
    "age": 30,
    "city": "New York",
    "onboardingStep": "PERSONAL_INFO_COMPLETE",
    "createdAt": "2025-12-26T00:00:00.000Z",
    "updatedAt": "2025-12-26T00:00:00.000Z"
  }
}
```

**Error (404):**

```json
{
  "success": false,
  "message": "Patient not found",
  "error": "PATIENT_NOT_FOUND"
}
```

---

## Saved Doctors

### Save Doctor

Save a doctor to a patient's saved list.

**Endpoint:** `POST /patients/saved-doctors`

### Request Body

```json
{
  "patientId": "uuid-string-here",
  "doctorId": "uuid-string-here"
}
```

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Doctor saved successfully",
  "data": {
    "patientId": "uuid-string-here",
    "doctorId": "uuid-string-here"
  }
}
```

**Error (400):**

```json
{
  "success": false,
  "message": "Doctor is already saved",
  "error": "DOCTOR_ALREADY_SAVED"
}
```

**Error (404):**

```json
{
  "success": false,
  "message": "Patient not found",
  "error": "PATIENT_NOT_FOUND"
}
```

```json
{
  "success": false,
  "message": "Doctor not found",
  "error": "DOCTOR_NOT_FOUND"
}
```

---

### Unsave Doctor

Remove a doctor from a patient's saved list.

**Endpoint:** `DELETE /patients/saved-doctors`

### Request Body

```json
{
  "patientId": "uuid-string-here",
  "doctorId": "uuid-string-here"
}
```

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Doctor unsaved successfully",
  "data": {
    "patientId": "uuid-string-here",
    "doctorId": "uuid-string-here"
  }
}
```

**Error (404):**

```json
{
  "success": false,
  "message": "Patient not found",
  "error": "PATIENT_NOT_FOUND"
}
```

---

### Get Saved Doctors

Get all saved doctors for a patient.

**Endpoint:** `GET /patients/:patientId/saved-doctors`

### Path Parameters

- **patientId** (required): Patient UUID

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Saved doctors fetched successfully",
  "data": [
    {
      "id": "uuid-string-here",
      "email": "doctor@example.com",
      "name": "Dr. John Doe",
      "age": 35,
      "gender": "MALE",
      "specialty": "Cardiology",
      "city": "New York",
      "locality": "Manhattan",
      "yearsOfExperience": 10,
      "viewCount": 15,
      "createdAt": "2025-12-26T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

**Error (404):**

```json
{
  "success": false,
  "message": "Patient not found",
  "error": "PATIENT_NOT_FOUND"
}
```

### Notes

- The saved doctors list includes full doctor details including view count
- Patients can save multiple doctors
- The same doctor cannot be saved twice (will return `DOCTOR_ALREADY_SAVED` error)

---

## Notes

- All endpoints return JSON responses
- The JWT token from OTP verification should be included in the `Authorization` header for authenticated requests
- Both `doctorId` and `patientId` are UUID strings (not integers)
- If an account with the email already exists during signup, a 409 error will be returned
- OTP codes expire after 10 minutes
- In development mode, if email is not configured, the OTP will be returned in the response
- All string fields are trimmed automatically
- Phone numbers accept various formats (with/without country codes, spaces, dashes, etc.)
- Login endpoints return JWT tokens that can be used for authenticated requests
- Doctor profiles have a `viewCount` field that tracks how many times the profile has been viewed
- Use `POST /doctors/:id/view` to view a doctor's profile and increment the view count
- Patients can save doctors to their saved list for quick access later

