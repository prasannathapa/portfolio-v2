const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');
const Security = require('../utils/security');
const { saveData } = require('../utils/utils');
const { sendEmail } = require('../services/emailService');
const htmlTemplates = require('../services/htmlTemplates');
const config = require('../config/config');

// 1. DASHBOARD (With Self-Healing)
router.get('/dashboard', async (req, res) => {
    const { token } = req.query;
    try {
        jwt.verify(token, config.ADMIN_SECRET);
        
        const users = db.prepare('SELECT * FROM users ORDER BY last_seen DESC LIMIT 100').all();

        const rows = users.map(u => {
            let badgeClass = 'bg-gray';
            if (u.access_level < 0) badgeClass = 'bg-red';
            else if (u.access_level > 0 && u.access_level < 5) badgeClass = 'bg-green';
            else if (u.access_level >= 5) badgeClass = 'bg-gold';

            const options = [-1, 0, 1, 2, 3, 4, 5].map(l => 
                `<option value="${l}" ${u.access_level === l ? 'selected' : ''}>${l === -1 ? 'Block' : l === 0 ? 'Public' : l === 5 ? 'VIP' : 'Lvl ' + l}</option>`
            ).join('');

            return `
            <tr class="user-row">
                <td><span class="user-name">${u.name || 'Anonymous'}</span><span class="user-email">${u.email || 'No Email'}</span></td>
                <td><span class="uuid">${u.uuid.substring(0,8)}...</span></td>
                <td><span class="badge ${badgeClass}">${u.access_level}</span></td>
                <td>
                    <div class="actions">
                        <form action="/admin/update-level" method="POST" style="margin:0;">
                            <input type="hidden" name="token" value="${token}">
                            <input type="hidden" name="uuid" value="${u.uuid}">
                            <select name="level" onchange="this.form.submit()">${options}</select>
                        </form>
                        <form action="/admin/delete-user" method="POST" onsubmit="return confirm('Delete user permanently?');" style="margin:0;">
                            <input type="hidden" name="token" value="${token}">
                            <input type="hidden" name="uuid" value="${u.uuid}">
                            <button type="submit" class="btn-delete" title="Delete User">🗑️ Delete</button>
                        </form>
                    </div>
                </td>
            </tr>`;
        }).join('');

        res.send(htmlTemplates.generateAdminDashboard(rows, token));

    } catch (error) {
        // --- SELF HEALING LOGIC ---
        if (error.name === 'TokenExpiredError') {
            console.log("[Admin] 🛡️ Token expired. Generating fresh link...");
            const newToken = jwt.sign({ role: 'admin' }, config.ADMIN_SECRET, { expiresIn: config.ADMIN_TOKEN_EXPIRY });
            const newLink = `${config.BASE_URL}/admin/dashboard?token=${newToken}`;
            
            await sendEmail(config.EMAIL_TO, "🔐 New Admin Link", `
                <p>You (or someone) tried to access the dashboard with an expired link.</p>
                <p>Here is a fresh one (valid for 15 mins):</p>
                <p><a href="${newLink}"><b>Access Dashboard</b></a></p>
            `);

            return res.send(`
                <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h1>Link Expired</h1>
                    <p>For security, admin links expire quickly.</p>
                    <p>✅ <b>I just sent a fresh link to your email.</b> check your inbox.</p>
                </div>
            `);
        }
        return res.status(401).send("Unauthorized Access.");
    }
});

// 2. UPDATE LEVEL
router.post('/update-level', (req, res) => {
    try {
        jwt.verify(req.body.token, config.ADMIN_SECRET);
        const lvl = parseInt(req.body.level);
        db.prepare('UPDATE users SET access_level = ? WHERE uuid = ?').run(lvl, req.body.uuid);

        const u = db.prepare('SELECT email FROM users WHERE uuid = ?').get(req.body.uuid);
        if (u && u.email) {
            if (lvl === -1) Security.addToBlacklist(u.email, "Admin Block");
            else Security.removeFromBlacklist(u.email);
        }
        res.redirect(`/admin/dashboard?token=${req.body.token}&msg=updated`);
    } catch (e) { res.status(401).send("Unauthorized"); }
});

// 3. DELETE USER
router.post('/delete-user', (req, res) => {
    try {
        jwt.verify(req.body.token, config.ADMIN_SECRET);
        db.prepare('DELETE FROM users WHERE uuid = ?').run(req.body.uuid);
        res.redirect(`/admin/dashboard?token=${req.body.token}&msg=deleted`);
    } catch (e) { res.status(401).send("Unauthorized"); }
});

// 4. DATA SYNC
router.post('/data', (req, res) => {
    if (req.headers['x-admin-password'] !== config.ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
    saveData(req.body);
    res.json({ status: "updated" });
});

module.exports = router;