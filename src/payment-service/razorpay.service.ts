
import Razorpay from 'razorpay';
import { AppError } from '../utils/AppError';
import { INTERNAL_SERVER_ERROR } from '../utils/httpStatusCodes';

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export const createLinkedAccount = async (doctor: { email: string, name: string, phone: string, bankAccountNumber: string, bankIfsc: string, bankBeneficiaryName: string }) => {
    try {
        const account = await (razorpay.accounts as any).create({
            email: doctor.email,
            phone: doctor.phone,
            type: 'route',
            legal_business_name: doctor.name,
            profile: {
                category: 'healthcare',
                subcategory: 'doctor_and_other_healthcare_professionals',
            },
            requested_products: ['settlements'],
            product_config: {
                settlements: {
                    features: ['parent_settlement'],
                    settlement_details: {
                        account_number: doctor.bankAccountNumber,
                        ifsc_code: doctor.bankIfsc,
                        beneficiary_name: doctor.bankBeneficiaryName,
                    }
                }
            }
        });
        return account;
    } catch (error: any) {
        console.error('Razorpay Account Creation Error:', error);
        throw new AppError('Error creating Razorpay linked account: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const createOrder = async (amount: number, doctorRazorpayId: string, commissionPercent: number = 10) => {
    try {
        const commission = Math.round(amount * (commissionPercent / 100));
        const amountToTransfer = amount - commission;

        const order = await razorpay.orders.create({
            amount: amount, // Total amount in paise
            currency: 'INR',
            transfers: [
                {
                    account: doctorRazorpayId,
                    amount: amountToTransfer,
                    currency: 'INR',
                    on_hold: false,
                }
            ]
        });
        return order;
    } catch (error: any) {
        console.error('Razorpay Order Creation Error:', error);
        throw new AppError('Error creating Razorpay order: ' + error.message, INTERNAL_SERVER_ERROR);
    }
};

export const verifyPaymentSignature = (orderId: string, paymentId: string, signature: string) => {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(orderId + "|" + paymentId);
    const expectedSignature = hmac.digest('hex');
    return expectedSignature === signature;
};
