const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');

const db = require('../database');
const Security = require('../utils/security');
const { loadData, recursiveFilter, getAccessLevel, registerUser } = require('../utils/utils');
const { generateResponse } = require('../services/aiService');
const { sendEmail } = require('../services/emailService');
const htmlTemplates = require('../services/htmlTemplates');
const taskQueue = require('../utils/queue');
const config = require('../config/config');

const COOLDOWN_PERIOD = 24 * 60 * 60 * 1000; // 24 Hours

// 1. GET PORTFOLIO
router.get('/portfolio', (req, res) => {
    const uuid = req.headers['x-access-token'] || req.query.uuid;
    const accessLevel = getAccessLevel(uuid);
    console.log("accessed: "+uuid);
    
    if (uuid) db.prepare('INSERT INTO access_logs (uuid, ip, payload) VALUES (?, ?, ?)').run(uuid, req.ip, 'Portfolio View');
    res.json({
        content: recursiveFilter(loadData(), accessLevel),
        meta: { registered: !!uuid && accessLevel !== 0, level: accessLevel }
    });
});

// 2. REQUEST
router.post('/request', async (req, res) => {
    const { email, name, message, company, type } = req.body;
    
    if (email && Security.isBlacklisted(email)) return res.status(403).json({ error: "Access Denied" });
    if (Security.isMalicious(message) || Security.isMalicious(name)) {
        db.prepare('INSERT INTO access_logs (email, name, ip, payload) VALUES (?, ?, ?, ?)').run(email, `[ATTACK] ${name}`, req.ip, message);
        return res.json({ status: "Received" });
    }

    const uuid = registerUser(email, name, req.headers['x-access-token']);
    if (getAccessLevel(uuid) === -1) return res.status(403).json({ error: "Blocked by Admin" });

    taskQueue.add(async () => {
        console.log(`[Request] Processing ${type} for ${name} (${uuid})`);
        const blogs = loadData().find(d => d.type === 'blogs')?.blogs || [];
        const aiRes = await generateResponse(name, company, type, message, blogs);

        const adminToken = jwt.sign({ role: 'admin' }, config.ADMIN_SECRET, { expiresIn: config.ADMIN_TOKEN_EXPIRY });
        const unsubscribeToken = jwt.sign({ email }, config.JWT_SECRET);
        
        const adminLink = `${config.BASE_URL}/admin/dashboard?token=${adminToken}`;
        const unsubLink = `${config.BASE_URL}/api/unsubscribe?token=${unsubscribeToken}`;

        if (email) {
            const userHtml = htmlTemplates.generateUserEmail(aiRes.body, unsubLink);
            const attachments = [];
            if (aiRes.attachResume && fs.existsSync(config.RESUME_PATH)) {
                attachments.push({ filename: 'Prasanna_Thapa_Resume.pdf', path: config.RESUME_PATH });
            }
            await sendEmail(email, aiRes.subject, userHtml, attachments);
        }

        const adminHtml = htmlTemplates.generateAdminSummaryEmail(
            { name, email, uuid, type, company }, message, aiRes.body, aiRes.attachResume, adminLink
        );
        await sendEmail(config.EMAIL_TO, `[${type}] ${name}`, adminHtml);
    });

    res.json({ content: recursiveFilter(loadData(), getAccessLevel(uuid)), uuid: uuid, meta: { registered: true, level: getAccessLevel(uuid) } });
});

// 3. UNSUBSCRIBE (DATABASE BACKED RATE LIMIT)
router.get('/unsubscribe', async (req, res) => {
    try {
        const { email } = jwt.verify(req.query.token, config.JWT_SECRET);
        
        // 1. Block User
        Security.addToBlacklist(email, "User requested stop");
        db.prepare('UPDATE users SET access_level = -1 WHERE email = ?').run(email);
        
        // 2. Generate Return Token
        const returnToken = jwt.sign({ email, scope: 'whitelist' }, config.JWT_SECRET, { expiresIn: config.USER_RETURN_TOKEN_EXPIRY });
        const returnLink = `${config.BASE_URL}/api/security/whitelist?token=${returnToken}`;

        // 3. DB RATE LIMIT CHECK
        const cooldownKey = `unsub_email:${email}`;
        const record = db.prepare('SELECT timestamp FROM cooldowns WHERE key = ?').get(cooldownKey);
        const now = Date.now();

        // If no record OR time difference > 24 hours
        if (!record || (now - record.timestamp > COOLDOWN_PERIOD)) {
            console.log(`[Unsub] Sending safe-keeping email to ${email}`);
            
            // Send Email
            await sendEmail(email, "Settings updated", htmlTemplates.generateReturnTokenEmail(returnLink));
            
            // Upsert (Insert or Update) timestamp in DB
            db.prepare('INSERT INTO cooldowns (key, timestamp) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET timestamp = ?')
              .run(cooldownKey, now, now);
        } else {
            console.log(`[Unsub] Skipped email to ${email} (DB: Already sent in last 24h)`);
        }

        res.send(htmlTemplates.generateUnsubscribePage(email, returnLink));

    } catch (e) { res.status(400).send("This link seems invalid or broken."); }
});

// 4. WHITELIST
router.get('/security/whitelist', (req, res) => {
    try {
        const { email, scope } = jwt.verify(req.query.token, config.JWT_SECRET);
        if (scope === 'whitelist') {
            Security.removeFromBlacklist(email);
            db.prepare('UPDATE users SET access_level = 0 WHERE email = ?').run(email);
            db.prepare('INSERT INTO access_logs (email, name, ip) VALUES (?, ?, ?)').run(email, '[ACTION] User Restarted', req.ip);
            res.send(htmlTemplates.generateWhitelistPage(email));
        } else throw new Error();
    } catch (e) { res.status(400).send("Link expired."); }
});

// 5. HONEYPOT VERIFY
router.get('/security/verify', (req, res) => {
    const data = Security.verifyToken(req.query.token);
    if (data && data.action === 'blacklist') {
        Security.addToBlacklist(data.email, "Honeypot");
        db.prepare('UPDATE users SET access_level = -1 WHERE email = ?').run(data.email);
        const adminToken = jwt.sign({ role: 'admin' }, config.ADMIN_SECRET, { expiresIn: '365d' });
        const adminLink = `${config.BASE_URL}/admin/dashboard?token=${adminToken}`;
        
        config.ADMIN_EMAILS.forEach(a => taskQueue.add(() => sendEmail(a, "🚨 Honeypot Triggered", `User ${data.email} banned. <a href="${adminLink}">Manage</a>`)));
        return res.send("<h1>Banned</h1>");
    }
    res.status(400).send("Invalid");
});

module.exports = router;