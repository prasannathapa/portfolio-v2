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

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'frontend/dist'))); 

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

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

// --- ADMIN DASHBOARD UI ---
const generateAdminDashboard = (users, adminToken) => {
    const rows = users.map(u => {
        const levelColor = u.access_level < 0 ? 'bg-red-50 text-red-700' : (u.access_level > 0 ? 'bg-green-50 text-green-700' : 'text-gray-600');
        
        let options = '';
        const levels = [-1, 0, 1, 2, 3, 4, 5];
        const labels = { '-1': 'Blocked ⛔', '0': 'Public 🌍', '1': 'Basic 👤', '5': 'VIP ⭐' };
        
        levels.forEach(l => {
            const isSelected = u.access_level === l ? 'selected' : '';
            const label = labels[l] || `Level ${l}`;
            options += `<option value="${l}" ${isSelected}>${label}</option>`;
        });

        return `
        <tr class="border-b hover:bg-gray-50 transition-colors">
            <td class="p-4 font-medium text-gray-900">${u.name || 'Anonymous'}</td>
            <td class="p-4 font-mono text-sm text-gray-500">${u.email || '-'}</td>
            <td class="p-4"><code class="bg-gray-100 px-2 py-1 rounded text-xs select-all text-gray-500">${u.uuid}</code></td>
            <td class="p-4 font-bold ${levelColor}">${u.access_level}</td>
            <td class="p-4 text-xs text-gray-400">${new Date(u.last_seen).toLocaleDateString()}</td>
            <td class="p-4">
                <form action="/api/admin/update-level" method="POST" class="flex items-center gap-2">
                    <input type="hidden" name="token" value="${adminToken}">
                    <input type="hidden" name="uuid" value="${u.uuid}">
                    <select name="level" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-1 border bg-white">
                        ${options}
                    </select>
                    <button type="submit" class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-1 px-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                        Update
                    </button>
                </form>
            </td>
        </tr>`;
    }).join('');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Portfolio Control Center</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 min-h-screen font-sans">
        <div class="max-w-7xl mx-auto py-10 px-4">
            <div class="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                <div class="bg-gray-900 px-6 py-5 border-b border-gray-800 flex justify-between items-center">
                    <h1 class="text-xl font-bold text-white">🛡️ Access Control</h1>
                    <span class="bg-gray-800 px-3 py-1 text-xs text-gray-300 rounded-full">${users.length} Users</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                                <th class="p-4">User</th>
                                <th class="p-4">Contact</th>
                                <th class="p-4">UUID</th>
                                <th class="p-4">Level</th>
                                <th class="p-4">Active</th>
                                <th class="p-4 w-48">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 bg-white">${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>
    </body>
    </html>`;
};

// --- EMAILER ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT), secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

const sendEmail = async (to, subject, html, attachments = []) => {
    console.log(`[Email] 📧 Sending to: ${to}`);
    return transporter.sendMail({ from: `"Prasanna Thapa" <${process.env.SMTP_USER}>`, to, subject, html, attachments });
};

// --- ROUTES ---

// 1. GET PORTFOLIO (The View Layer)
app.get('/api/portfolio', (req, res) => {
    const uuid = req.headers['x-access-token'] || req.query.uuid;
    
    // Check Status in DB
    let accessLevel = 0;
    let isRegistered = false;

    if (uuid) {
        const user = db.prepare('SELECT access_level FROM users WHERE uuid = ?').get(uuid);
        if (user) {
            accessLevel = user.access_level;
            isRegistered = true; 
            db.prepare('INSERT INTO access_logs (uuid, ip, payload) VALUES (?, ?, ?)').run(uuid, req.ip, 'Portfolio View');
        }
    }

    // Filter Data & Return Metadata
    const content = recursiveFilter(loadData(), accessLevel);
    res.json({
        content: content,
        meta: { registered: isRegistered, level: accessLevel }
    });
});

// 2. UNIFIED REQUEST HANDLER (The Logic Layer)
app.post('/api/request', async (req, res) => {
    const { email, name, message, company, type } = req.body; 
    const userUuidHeader = req.headers['x-access-token'];

    // Security Checks
    if (email && Security.isBlacklisted(email)) return res.status(403).json({ error: "Access Denied" });
    if (Security.isMalicious(message) || Security.isMalicious(name)) {
        db.prepare('INSERT INTO access_logs (email, name, ip, payload) VALUES (?, ?, ?, ?)').run(email, `[ATTACK] ${name}`, req.ip, message);
        return res.json({ status: "Received" });
    }

    // Register User
    const uuid = registerUser(email, name, userUuidHeader);
    const currentLevel = getAccessLevel(uuid);
    if (currentLevel === -1) return res.status(403).json({ error: "Blocked by Admin" });

    // Process Async
    taskQueue.add(async () => {
        console.log(`[Request] ${type} | ${name} | ${uuid}`);
        let aiRes = { subject: "Re: Request", body: "<p>Received.</p>", attachResume: false };
        
        try {
            if (process.env.GEMINI_API_KEY) {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const projects = loadData().find(d => d.type === 'blogs')?.blogs || [];
                const projectsContext = projects.map(p => ({ title: p.title, description: p.content, link: p.blog || "" }));
                const prompt = `ACT AS: Prasanna Thapa. CONTEXT: ${type}. MSG: "${message}" (Co: ${company}). PROJECTS: ${JSON.stringify(projectsContext)}. TASK: HTML response. JSON Schema: {subject, body, attachResume}`;
                aiRes = await runWithRetry(async () => {
                    const model = ai.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
                    const result = await model.generateContent(prompt);
                    return JSON.parse(result.response.text);
                });
            }
        } catch(e) { console.error("AI Error:", e.message); }

        const magicLink = `${FRONTEND_URL}/?uuid=${uuid}`;
        const adminToken = jwt.sign({ role: 'admin' }, ADMIN_SECRET, { expiresIn: '365d' });
        const adminDashboardLink = `${BASE_URL}/admin/dashboard?token=${adminToken}`;
        const unsubscribeLink = `${BASE_URL}/api/unsubscribe?token=${jwt.sign({ email }, JWT_SECRET)}`;

        if (email) {
            let userHtml = `<div style="font-family:sans-serif;color:#333;">${aiRes.body}`;
            if (type !== 'contact') {
                userHtml += `<div style="margin:30px 0;text-align:center;"><a href="${magicLink}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Access Portfolio</a><p style="font-size:11px;margin-top:5px;color:#666">Or use key: ${uuid}</p></div>`;
            }
            userHtml += `<p style="font-size:11px;color:#999;margin-top:20px;">Don't want these? <a href="${unsubscribeLink}">Unsubscribe</a></p></div>`;
            
            const attachments = [];
            if (aiRes.attachResume && fs.existsSync(RESUME_PATH)) attachments.push({ filename: 'Prasanna_Thapa_Resume.pdf', path: RESUME_PATH });
            await sendEmail(email, aiRes.subject, userHtml, attachments);
        }

        const adminHtml = `
            <div style="font-family:sans-serif;border:1px solid #ddd;padding:20px;border-radius:8px;">
                <h2>New Request: ${type}</h2>
                <p><strong>${name}</strong> (${email || 'Anon'})</p>
                <p>UUID: <code>${uuid}</code></p>
                <div style="background:#f9f9f9;padding:10px;margin:10px 0;font-style:italic;">"${message}"</div>
                <a href="${adminDashboardLink}" style="background:#dc3545;color:#fff;padding:10px;text-decoration:none;border-radius:4px;display:inline-block;">Manage Access</a>
            </div>`;
        await sendEmail(process.env.EMAIL_TO, `[${type}] ${name}`, adminHtml);
    });

    const publicData = recursiveFilter(loadData(), currentLevel);
    res.json({ content: publicData, uuid: uuid, meta: { registered: true, level: currentLevel } });
});

// ADMIN ROUTES
app.get('/admin/dashboard', (req, res) => {
    const { token } = req.query;
    try {
        jwt.verify(token, ADMIN_SECRET);
        const users = db.prepare('SELECT * FROM users ORDER BY last_seen DESC LIMIT 100').all();
        res.send(generateAdminDashboard(users, token));
    } catch (e) { res.status(401).send("Unauthorized"); }
});

app.post('/api/admin/update-level', (req, res) => {
    const { token, uuid, level } = req.body;
    try {
        jwt.verify(token, ADMIN_SECRET);
        const lvl = parseInt(level);
        db.prepare('UPDATE users SET access_level = ? WHERE uuid = ?').run(lvl, uuid);
        
        if (lvl === -1) {
            const u = db.prepare('SELECT email FROM users WHERE uuid = ?').get(uuid);
            if (u && u.email) Security.addToBlacklist(u.email, "Admin Block");
        } else {
            const u = db.prepare('SELECT email FROM users WHERE uuid = ?').get(uuid);
            if (u && u.email) Security.removeFromBlacklist(u.email);
        }
        res.redirect(`/admin/dashboard?token=${token}`);
    } catch (e) { res.status(401).send("Unauthorized"); }
});

// UTILITY ROUTES
app.get('/api/unsubscribe', (req, res) => {
    try {
        const { email } = jwt.verify(req.query.token, JWT_SECRET);
        Security.addToBlacklist(email, "Unsubscribed");
        db.prepare('UPDATE users SET access_level = -1 WHERE email = ?').run(email);
        res.send("<h1>Unsubscribed</h1>");
    } catch (e) { res.status(400).send("Invalid"); }
});

app.get('/api/security/verify', (req, res) => {
    const data = Security.verifyToken(req.query.token);
    if (data && data.action === 'blacklist') {
        Security.addToBlacklist(data.email, "Honeypot");
        db.prepare('UPDATE users SET access_level = -1 WHERE email = ?').run(data.email);
        
        const adminToken = jwt.sign({ role: 'admin' }, ADMIN_SECRET, { expiresIn: '365d' });
        const link = `${BASE_URL}/admin/dashboard?token=${adminToken}`;
        const alertHtml = `<h1>HoneyPot Triggered</h1><p>User ${data.email} banned.</p><a href="${link}">Manage Users</a>`;
        ADMIN_EMAILS.forEach(a => taskQueue.add(() => sendEmail(a, "🚨 Honeypot Triggered", alertHtml)));
        return res.send("<h1>Banned</h1>");
    }
    res.status(400).send("Invalid");
});

app.post('/api/admin/data', (req, res) => {
    if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    saveData(req.body);
    res.json({ status: "updated" });
});

app.listen(PORT, () => {
    console.log(`\n🚀 AI Agent Server running on http://localhost:${PORT}`);
});