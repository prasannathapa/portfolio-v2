require('dotenv').config();
const path = require('path');

module.exports = {
    PORT: process.env.PORT || 4000,
    BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
    FRONTEND_PATH: path.join(__dirname, '../frontend/dist'),
    
    // Secrets
    JWT_SECRET: process.env.JWT_SECRET || "your-very-secure-secret-key",
    ADMIN_SECRET: process.env.ADMIN_SECRET || "admin-master-key-change-this",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,

    // Expiry Logic (The specific logic you requested)
    ADMIN_TOKEN_EXPIRY: '15m',        // Short-lived for security
    USER_RETURN_TOKEN_EXPIRY: '36500d', // Effectively eternal (100 years)

    // Email Config
    SMTP: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    EMAIL_TO: process.env.EMAIL_TO,
    ADMIN_EMAILS: [process.env.EMAIL_TO, 'prasannathapax7@gmail.com'],

    // Paths
    RESUME_PATH: path.join(__dirname, 'resume.pdf'),
    ABOUT_ME_PATH: path.join(__dirname, 'about_me.txt'),

    // AI Model
    MODEL_NAME: "gemini-2.5-flash-lite",
    EMAIL_RESPONSE_SCHEMA: {
        type: "object",
        properties: {
            subject: { type: "string", description: "Email subject line" },
            body: { type: "string", description: "Email body in HTML format (use <p>, <br>, <b>)." },
            attachResume: { type: "boolean", description: "True if resume should be attached." }
        },
        required: ["subject", "body", "attachResume"]
    }
};