// using global fetch (Node 18+)
// If fetch is not available, I'll use http. But let's try fetch.
// Actually, `npm run dev` is running, but I need to run this script separately.
// The user environment info says Node is installed.

const BASE_URL = 'http://localhost:3000/doctors';
const EMAIL = `test.doctor.${Date.now()}@example.com`;

async function runTest() {
    console.log(`Testing Onboarding Flow for ${EMAIL}...`);

    // 1. Send OTP (Authentication)
    console.log('1. Requesting OTP...');
    const authRes = await fetch(`${BASE_URL}/onboarding/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL })
    });

    const authData = await authRes.json();
    console.log('Authentication Response:', authData);

    if (!authData.mockOtp) {
        // If email somehow succeeded (unlikely) or something else happened
        // But for this test env we expect failure -> mockOtp
        if (authRes.ok) {
            console.log("Email sent successfully (presumably)? We might not have the OTP to verify.");
            // This might block the test if we can't get the OTP.
            // However based on .env, it SHOULD fail and return mockOtp.
        }
        if (!authData.mockOtp && authRes.status !== 500) {
            console.error('Did not receive mockOtp and not an error?');
        }
    }

    const otp = authData.mockOtp;
    if (!otp) {
        console.error('Cannot proceed without OTP.');
        return;
    }
    console.log(`Got Mock OTP: ${otp}`);

    // 2. Verify OTP
    console.log('2. Verifying OTP...');
    const verifyRes = await fetch(`${BASE_URL}/onboarding/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, otp: otp })
    });

    const verifyData = await verifyRes.json();
    console.log('Verify Response:', verifyData);

    if (verifyRes.ok && verifyData.message === 'OTP verified') {
        console.log('SUCCESS: OTP verified successfully.');
    } else {
        console.error('FAILED: OTP verification failed.');
    }
}

// Node 18+ has native fetch. If on older node, this might fail unless node-fetch is installed.
// The package.json didn't show node-fetch.
// I'll assume Node 18+ for now.
runTest().catch(console.error);
