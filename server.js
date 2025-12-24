require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { GoogleGenAI } = require("@google/genai");

// --- INTERNAL MODULES ---
const db = require('./database');
const { loadData, recursiveFilter, saveData, getAccessLevel } = require('./utils');
const Security = require('./security');
const taskQueue = require('./queue');

const app = express();
const PORT = process.env.PORT || 4000;

// --- CONFIGURATION ---
const MODEL_NAME = "gemini-2.5-flash-lite";
const JWT_SECRET = process.env.JWT_SECRET || "your-very-secure-secret-key";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "admin-master-key-change-this";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:5173`;

const RESUME_PATH = path.join(__dirname, 'resume.pdf');
const ABOUT_ME_PATH = path.join(__dirname, 'about_me.txt');
const ADMIN_EMAILS = [process.env.EMAIL_TO, 'prasannathapax7@gmail.com'];

// --- STRICT JSON SCHEMA ---
const EMAIL_RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body in HTML format (use <p>, <br>, <b>)." },
        attachResume: { type: "boolean", description: "True if resume should be attached." }
    },
    required: ["subject", "body", "attachResume"]
};

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend/dist')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

const getContext = () => {
    try { return fs.readFileSync(ABOUT_ME_PATH, 'utf8'); }
    catch { return "Senior Software Engineer."; }
};

// --- HELPER: USER MANAGEMENT ---
const registerUser = (email, name, existingUuid) => {
    let uuid = existingUuid;
    let user = null;

    if (email) user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user && uuid) user = db.prepare('SELECT * FROM users WHERE uuid = ?').get(uuid);

    if (user) {
        uuid = user.uuid;
        if (email && !user.email) {
            db.prepare('UPDATE users SET email = ?, name = ?, last_seen = CURRENT_TIMESTAMP WHERE uuid = ?').run(email, name, uuid);
        } else {
            db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE uuid = ?').run(uuid);
        }
    } else {
        uuid = uuid || crypto.randomUUID();
        try {
            db.prepare('INSERT INTO users (uuid, email, name, access_level) VALUES (?, ?, ?, 0)').run(uuid, email || null, name || 'Anonymous');
        } catch (e) {
            if (email) {
                user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
                if (user) uuid = user.uuid;
            }
        }
    }
    return uuid;
};

// --- HELPER: AI RETRY LOGIC ---
const runWithRetry = async (fn, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try { return await fn(); }
        catch (error) {
            const isRateLimit = error.message?.includes('429') || (error.status === 429);
            if (isRateLimit && i < retries - 1) {
                const delay = 2000 * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else { throw error; }
        }
    }
};

// --- EMAIL TEMPLATES ---

const generateUserEmail = (aiBodyContent, unsubscribeLink) => {
    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; font-size: 15px;">
        <div style="max-width: 580px; margin: 0 auto; padding: 20px;">
            <div>${aiBodyContent}</div>
            <div style="margin-top: 50px; padding-top: 15px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #aaa;">
                <p style="margin: 0;">
                    Sent via <a href="https://prasannathapa.in" style="color: #aaa; text-decoration: none;">prasannathapa.in</a>.
                    <span style="margin: 0 8px;">|</span>
                    <a href="${unsubscribeLink}" style="color: #aaa; text-decoration: underline;">Stop emails</a>
                </p>
            </div>
        </div>
    </div>`;
};

const generateAdminSummaryEmail = (userDetails, originalMessage, aiResponseHtml, attachedResume, adminLink) => {
    return `
    <div style="font-family: sans-serif; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; max-width: 600px; margin: 0 auto; background: #fff;">
        <h3 style="color: #111; margin-top: 0; font-size: 18px;">Request: ${userDetails.type}</h3>
        <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; font-size: 14px; margin-bottom: 20px; border: 1px solid #f3f4f6;">
            <strong>${userDetails.name}</strong> <span style="color:#6b7280">&lt;${userDetails.email || 'No Email'}&gt;</span><br>
            <span style="color: #6b7280; font-size: 12px;">Company: ${userDetails.company || '-'}</span>
        </div>
        <div style="margin-bottom: 20px;">
            <div style="font-size: 11px; font-weight: bold; color: #9ca3af; margin-bottom: 6px; letter-spacing: 0.5px;">MESSAGE</div>
            <div style="padding: 12px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; font-style: italic; color: #92400e;">"${originalMessage}"</div>
        </div>
        <div style="margin-bottom: 25px;">
            <div style="font-size: 11px; font-weight: bold; color: #9ca3af; margin-bottom: 6px; letter-spacing: 0.5px;">AI REPLY (Resume: ${attachedResume ? '✅' : '❌'})</div>
            <div style="padding: 12px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; font-size: 14px; color: #166534;">${aiResponseHtml}</div>
        </div>
        <div style="text-align: center;">
            <a href="${adminLink}" style="background-color: #111; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">Manage Access</a>
        </div>
    </div>`;
};

const generateResubscribeEmail = (resubscribeLink) => `
    <div style="font-family: sans-serif; padding: 40px 20px; text-align: center; color: #333; max-width: 500px; margin: 0 auto;">
        <h2 style="font-weight: 600; margin-bottom: 10px;">Emails Stopped</h2>
        <p style="color: #555; font-size: 16px; margin-bottom: 30px;">I've updated my settings. You won't receive further emails from my website.</p>
        <p><a href="${resubscribeLink}" style="color: #2563eb; text-decoration: none; font-size: 14px;">Mistake? Allow emails</a></p>
    </div>`;

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT), secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

const sendEmail = async (to, subject, html, attachments = []) => {
    console.log(`[Email] 📧 Sending to: ${to}`);
    return transporter.sendMail({ from: `"Prasanna Thapa" <${process.env.SMTP_USER}>`, to, subject, html, attachments });
};

// --- ROUTES ---

app.get('/api/portfolio', (req, res) => {
    const uuid = req.headers['x-access-token'] || req.query.uuid;
    const accessLevel = getAccessLevel(uuid);
    if (uuid) db.prepare('INSERT INTO access_logs (uuid, ip, payload) VALUES (?, ?, ?)').run(uuid, req.ip, 'Portfolio View');
    res.json({
        content: recursiveFilter(loadData(), accessLevel),
        meta: { registered: !!uuid && accessLevel !== 0, level: accessLevel }
    });
});

app.post('/api/request', async (req, res) => {
    const { email, name, message, company, type } = req.body;
    const userUuidHeader = req.headers['x-access-token'];

    if (email && Security.isBlacklisted(email)) return res.status(403).json({ error: "Access Denied" });
    if (Security.isMalicious(message) || Security.isMalicious(name)) {
        db.prepare('INSERT INTO access_logs (email, name, ip, payload) VALUES (?, ?, ?, ?)').run(email, `[ATTACK] ${name}`, req.ip, message);
        return res.json({ status: "Received" });
    }

    const uuid = registerUser(email, name, userUuidHeader);
    const currentLevel = getAccessLevel(uuid);
    if (currentLevel === -1) return res.status(403).json({ error: "Blocked by Admin" });

    taskQueue.add(async () => {
        console.log(`[Request] Processing ${type} for ${name} (${uuid})`);
        let aiRes = { subject: "Re: Request", body: "<p>Received.</p>", attachResume: false };

        try {
            if (process.env.GEMINI_API_KEY) {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const projects = loadData().find(d => d.type === 'blogs')?.blogs || [];
                const projectsContext = projects.map(p => ({ title: p.title, description: p.content, link: p.blog || "" }));

                // --- DYNAMIC & DEFENSIVE AI PROMPT ---
                let instructions = "";
                if (type === 'resume') {
                    instructions = `
                    ACT AS: Prasanna Thapa (Me).
                    TONE: Professional, Honest, Protective of Data. First-person.
                    
                    DECISION LOGIC:
                    1. ANALYZE the 'Message' and 'Company' fields.
                    2. IF the request seems GENUINE (valid company, clear intent, professional wording):
                       - Write a polite response matching my skills (from PROFILE) to their context.
                       - You may add projects or blogs or other details based on requirements
                       - Set "attachResume": true.
                    3. IF the request looks like SPAM, FRAUD, or suspecious:
                       - Write a polite but firm response stating: "To protect my privacy, I only share my full resume with verified recruiters or active job opportunities. Please provide your official company email or job details to proceed. or rephrase it depending on the context, like I am already working in X if the recuiter is from X comapny.. make it personalised"
                       - You may add projects or blogs or other details based on requirements
                       - Set "attachResume": false.
                    `;
                } else if (type === 'contact') {
                    instructions = `
                    ACT AS: Prasanna Thapa (Me).
                    TONE: Casual, friendly, slightly humorous. First-person.
                    TASK: Acknowledge the message warmly.
                    You may add projects or blogs or other details based on requirements
                    ACTION: Set "attachResume": false, (inless needed explicitily)
                    `;
                } else {
                    instructions = `
                    ACT AS: Prasanna Thapa (Me).
                    TONE: Neutral, efficient.
                    TASK: Confirm receipt of request, add some cool interesting facts and make it personalised 
                    ACTION: Set "attachResume": false.
                    `;
                }

                const prompt = `
                ${instructions}
                
                MY PROFILE: ${getContext()}
                MY PROJECTS: ${JSON.stringify(projectsContext)}
                
                INCOMING MESSAGE:
                From: ${name}
                Company: ${company || "Not specified"}
                Type: ${type}
                Message: "${message}"

                CRITICAL: Output valid JSON matching schema. Body must be HTML. Sign off as 'Prasanna Thapa' and my desgination.
                `;

                aiRes = await runWithRetry(async () => {
                    const response = await ai.models.generateContent({
                        model: MODEL_NAME,
                        contents: prompt,
                        config: {
                            responseMimeType: "application/json",
                            responseJsonSchema: EMAIL_RESPONSE_SCHEMA
                        }
                    });

                    if (response.text) {
                        return JSON.parse(response.text);
                    }
                    throw new Error("Empty response from AI");
                });
            }
        } catch (e) { console.error("AI Error:", e.message); }

        // Links
        const adminToken = jwt.sign({ role: 'admin' }, ADMIN_SECRET, { expiresIn: '365d' });
        const adminDashboardLink = `${BASE_URL}/admin/dashboard?token=${adminToken}`;
        const unsubscribeLink = `${BASE_URL}/api/unsubscribe?token=${jwt.sign({ email }, JWT_SECRET)}`;

        if (email) {
            const userHtml = generateUserEmail(aiRes.body, unsubscribeLink);
            const attachments = [];
            // Strict check: Only attach if AI authorized it AND file exists
            if (aiRes.attachResume && fs.existsSync(RESUME_PATH)) {
                attachments.push({ filename: 'Prasanna_Thapa_Resume.pdf', path: RESUME_PATH });
            }
            await sendEmail(email, aiRes.subject, userHtml, attachments);
        }

        const adminHtml = generateAdminSummaryEmail(
            { name, email, uuid, type, company },
            message,
            aiRes.body,
            aiRes.attachResume,
            adminDashboardLink
        );
        await sendEmail(process.env.EMAIL_TO, `[${type}] ${name}`, adminHtml);
    });

    const publicData = recursiveFilter(loadData(), currentLevel);
    res.json({ content: publicData, uuid: uuid, meta: { registered: true, level: currentLevel } });
});

// --- ADMIN ROUTES ---
app.get('/admin/dashboard', (req, res) => {
    const { token } = req.query;
    try {
        jwt.verify(token, ADMIN_SECRET);
        const users = db.prepare('SELECT * FROM users ORDER BY last_seen DESC LIMIT 100').all();

        const rows = users.map(u => {
            const levelColor = u.access_level < 0 ? 'bg-red-50 text-red-700' : (u.access_level > 0 ? 'bg-green-50 text-green-700' : 'text-gray-600');
            let options = [-1, 0, 1, 2, 3, 4, 5].map(l =>
                `<option value="${l}" ${u.access_level === l ? 'selected' : ''}>${l === -1 ? 'Block' : l === 0 ? 'Public' : l === 5 ? 'VIP' : 'Lvl ' + l}</option>`
            ).join('');

            return `<tr class="border-b hover:bg-gray-50">
                <td class="p-3 font-bold">${u.name || 'Anon'}</td>
                <td class="p-3 text-sm">${u.email || '-'}</td>
                <td class="p-3 text-xs font-mono text-gray-400 select-all">${u.uuid}</td>
                <td class="p-3 font-bold ${levelColor}">${u.access_level}</td>
                <td class="p-3">
                    <form action="/api/admin/update-level" method="POST" class="flex gap-2">
                        <input type="hidden" name="token" value="${token}">
                        <input type="hidden" name="uuid" value="${u.uuid}">
                        <select name="level" class="border rounded px-2 py-1 text-sm">${options}</select>
                        <button class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Save</button>
                    </form>
                </td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html><html lang="en"><head><title>Admin</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="bg-gray-100 p-10"><div class="max-w-6xl mx-auto bg-white shadow rounded-lg p-6">
        <h1 class="text-2xl font-bold mb-4">🛡️ User Control</h1>
        <table class="w-full text-left"><thead><tr class="bg-gray-200">
        <th class="p-3">User</th><th class="p-3">Email</th><th class="p-3">UUID</th><th class="p-3">Lvl</th><th class="p-3">Action</th>
        </tr></thead><tbody>${rows}</tbody></table></div></body></html>`;

        res.send(html);
    } catch (e) { res.status(401).send("Unauthorized"); }
});

app.post('/api/admin/update-level', (req, res) => {
    try {
        jwt.verify(req.body.token, ADMIN_SECRET);
        const lvl = parseInt(req.body.level);
        db.prepare('UPDATE users SET access_level = ? WHERE uuid = ?').run(lvl, req.body.uuid);

        const u = db.prepare('SELECT email FROM users WHERE uuid = ?').get(req.body.uuid);
        if (u && u.email) {
            if (lvl === -1) Security.addToBlacklist(u.email, "Admin Block");
            else Security.removeFromBlacklist(u.email);
        }
        res.redirect(`/admin/dashboard?token=${req.body.token}`);
    } catch (e) { res.status(401).send("Unauthorized"); }
});

// --- UTILITY ROUTES ---
app.get('/api/unsubscribe', (req, res) => {
    try {
        const { email } = jwt.verify(req.query.token, JWT_SECRET);
        Security.addToBlacklist(email, "Unsubscribed");
        db.prepare('UPDATE users SET access_level = -1 WHERE email = ?').run(email);
        const resubLink = `${BASE_URL}/api/security/whitelist?token=${jwt.sign({ email, scope: 'whitelist' }, JWT_SECRET)}`;
        res.send(generateResubscribeEmail(resubLink));
    } catch (e) { res.status(400).send("Invalid Link"); }
});

app.get('/api/security/whitelist', (req, res) => {
    try {
        const { email, scope } = jwt.verify(req.query.token, JWT_SECRET);
        if (scope === 'whitelist') {
            Security.removeFromBlacklist(email);
            db.prepare('INSERT INTO access_logs (email, name, ip) VALUES (?, ?, ?)').run(email, '[ACTION] Resubscribed', req.ip);
            res.send(`<div style="font-family:sans-serif;text-align:center;padding:50px;"><h1>Welcome back</h1><p>You can now receive emails again.</p></div>`);
        } else throw new Error();
    } catch (e) { res.status(400).send("Invalid Link"); }
});

app.get('/api/security/verify', (req, res) => {
    const data = Security.verifyToken(req.query.token);
    if (data && data.action === 'blacklist') {
        Security.addToBlacklist(data.email, "Honeypot");
        db.prepare('UPDATE users SET access_level = -1 WHERE email = ?').run(data.email);
        const adminLink = `${BASE_URL}/admin/dashboard?token=${jwt.sign({ role: 'admin' }, ADMIN_SECRET, { expiresIn: '365d' })}`;
        ADMIN_EMAILS.forEach(a => taskQueue.add(() => sendEmail(a, "🚨 Honeypot Triggered", `User ${data.email} banned. <a href="${adminLink}">Manage</a>`)));
        return res.send("<h1>Banned</h1>");
    }
    res.status(400).send("Invalid");
});

app.post('/api/admin/data', (req, res) => {
    if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    saveData(req.body);
    res.json({ status: "updated" });
});

app.listen(PORT, () => { console.log(`\n🚀 AI Agent Server running on http://localhost:${PORT}`); });