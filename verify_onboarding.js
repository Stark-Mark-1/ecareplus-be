// Using native fetch (Node 18+)

const BASE_URL = 'http://localhost:3000';

async function runTest() {
    try {
        console.log('--- Authentication: Email OTP or Google ---');
        const authRes = await fetch(`${BASE_URL}/doctors/onboarding/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: `test.doctor.${Date.now()}@example.com` })
        });
        const authData = await authRes.json();
        console.log('Authentication Response:', authData);
        const doctorId = authData.doctorId;

        if (!doctorId) throw new Error('Doctor ID not returned in Authentication');

        console.log('\n--- Personal Info: Name, Age, Gender, Language, Phone Number ---');
        const personalInfoRes = await fetch(`${BASE_URL}/doctors/onboarding/personal-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                doctorId,
                name: 'Test Doctor',
                age: 35,
                gender: 'Female',
                languages: ['English', 'French'],
                contactNumber: '1234567890',
                whatsappNumber: '0987654321'
            })
        });
        console.log('Personal Info Response:', await personalInfoRes.json());

        console.log('\n--- Professional Info: Specialty, Years of Experience, Recent Grad ---');
        const professionalInfoRes = await fetch(`${BASE_URL}/doctors/onboarding/professional-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                doctorId,
                specialty: 'Neurology',
                yearsOfExperience: 10,
                latestQualification: 'MD, PhD'
            })
        });
        console.log('Professional Info Response:', await professionalInfoRes.json());

        console.log('\n--- Availability: Location, Available Days, Timing ---');
        const availabilityRes = await fetch(`${BASE_URL}/doctors/onboarding/availability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                doctorId,
                address: 'Downtown Medical Center, 123 Main St',
                city: 'Mumbai',
                locality: 'Bandra West',
                availableDays: ['Mon', 'Wed', 'Fri'],
                availableTiming: '08:00-16:00'
            })
        });
        console.log('Availability Response:', await availabilityRes.json());

        console.log('\n--- Verification Complete ---');

    } catch (error) {
        console.error('Verification Failed:', error);
    }
}

runTest();
