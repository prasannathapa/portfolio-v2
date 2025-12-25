const nodemailer = require('nodemailer');
const config = require('../config/config');

const transporter = nodemailer.createTransport({
    host: config.SMTP.host,
    port: config.SMTP.port,
    secure: true,
    auth: { user: config.SMTP.user, pass: config.SMTP.pass }
});

const sendEmail = async (to, subject, html, attachments = []) => {
    console.log(`[Email] 📧 Sending to: ${to}`);
    return transporter.sendMail({ 
        from: `"Prasanna Thapa" <${config.SMTP.user}>`, 
        to, subject, html, attachments 
    });
};

module.exports = { sendEmail };