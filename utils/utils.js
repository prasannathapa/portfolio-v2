const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../database');

// Configuration
const DATA_FILE = path.join(__dirname, '../config/data.json');
const BACKUP_DIR = path.join(__dirname, '../backups');

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// 1. LOAD DATA
const loadData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8').replace(/^\uFEFF/, ''));
    } catch (e) { console.error("❌ JSON Load Error:", e.message); return {}; }
};

// 2. SAVE DATA
const saveData = (newData) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `data.backup.${timestamp}.json`));
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2), 'utf8');
        return true;
    } catch (e) { console.error("❌ Save Error:", e.message); throw new Error("Failed to save."); }
};

// 3. GET ACCESS LEVEL
const getAccessLevel = (uuid) => {
    if (!uuid) return 0;
    try {
        const user = db.prepare('SELECT access_level FROM users WHERE uuid = ? or email = ?').get(uuid, uuid);
        if (user) return user.access_level;
        return 0;
    } catch (e) { return 0; }
};

// 4. USER REGISTRATION HELPER (Moved from server.js)
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

// 5. SMART RECURSIVE FILTER
const recursiveFilter = (data, userLevel) => {
    if (userLevel === -1) return null; // Blocked User
    if (Array.isArray(data)) {
        const allowedItems = data.map(item => recursiveFilter(item, userLevel)).filter(item => item !== null);
        const typeGroups = {};
        const keepList = [];
        allowedItems.forEach(item => {
            if (typeof item === 'object' && item !== null && item.type) {
                if (item.type === 'project') { keepList.push(item); return; }
                if (!typeGroups[item.type]) typeGroups[item.type] = [];
                typeGroups[item.type].push(item);
            } else { keepList.push(item); }
        });
        const bestGroupedItems = Object.values(typeGroups).map(group => {
            group.sort((a, b) => (b.access || 0) - (a.access || 0));
            return group[0];
        });
        return [...keepList, ...bestGroupedItems];
    }
    if (typeof data === 'object' && data !== null) {
        if ((data.access || 0) > userLevel) return null;
        if (data.type === 'access') return null;
        const newObj = {};
        for (const [k, v] of Object.entries(data)) {
            const f = recursiveFilter(v, userLevel);
            if (f !== null) newObj[k] = f;
        }
        return newObj;
    }
    return data;
};

module.exports = { loadData, saveData, recursiveFilter, getAccessLevel, registerUser };