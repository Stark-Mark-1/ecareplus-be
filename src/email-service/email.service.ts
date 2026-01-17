
import * as brevo from '@getbrevo/brevo';

let brevoApiInstance: brevo.TransactionalEmailsApi | null = null;

const initializeBrevo = () => {
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
        console.warn('⚠️  BREVO_API_KEY not configured. Email sending will be disabled.');
        return null;
    }

    try {
        brevoApiInstance = new brevo.TransactionalEmailsApi();
        brevoApiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
        console.log('✅ Brevo API client initialized successfully');
        return brevoApiInstance;
    } catch (error) {
        console.error('❌ Failed to initialize Brevo API:', error);
        return null;
    }
};

initializeBrevo();

export const sendEmail = async (to: string, subject: string, htmlContent: string) => {
    if (!brevoApiInstance) {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEV] Mock Email to ${to}: ${subject}`);
            return true;
        }
        return false;
    }

    try {
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = htmlContent;
        sendSmtpEmail.sender = { 
            name: 'ECare+', 
            email: process.env.EMAIL_USER || 'noreply@ecareplus.com' 
        };
        sendSmtpEmail.to = [{ email: to }];

        await brevoApiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`✅ Email sent successfully to ${to}`);
        return true;
    } catch (error) {
        console.error('❌ Email send error:', error);
        return false;
    }
};
