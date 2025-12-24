const jwt = require('jsonwebtoken');
const db = require('./database');

// Secret for Trap Tokens (Honeypot)
const TRAP_SECRET = process.env.TRAP_SECRET || "honeypot-secret-key-change-me";

class Security {
    
    // --- DATABASE BLACKLIST METHODS ---

    static isBlacklisted(email) {
        if (!email) return false;
        const row = db.prepare('SELECT 1 FROM blacklist WHERE email = ?').get(email);
        return !!row; // Returns true if found, false otherwise
    }

    static addToBlacklist(email, reason = "General Ban") {
        try {
            const stmt = db.prepare('INSERT OR IGNORE INTO blacklist (email, reason) VALUES (?, ?)');
            const info = stmt.run(email, reason);
            if (info.changes > 0) {
                console.log(`[Security] 🚫 Banned User: ${email} | Reason: ${reason}`);
            }
        } catch (e) {
            console.error(`[Security] DB Error adding to blacklist: ${e.message}`);
        }
    }

    static removeFromBlacklist(email) {
        try {
            const stmt = db.prepare('DELETE FROM blacklist WHERE email = ?');
            const info = stmt.run(email);
            if (info.changes > 0) {
                console.log(`[Security] ✅ Unbanned User: ${email}`);
                return true;
            }
            return false;
        } catch (e) {
            console.error(`[Security] DB Error removing from blacklist: ${e.message}`);
            return false;
        }
    }

    // --- EXISTING MALICIOUS CHECKS ---

    static isMalicious(input) {
        if (!input || typeof input !== 'string') return false;
        
        // Common SQL Injection & XSS patterns
        const patterns = [
            /<script>/i,
            /javascript:/i,
            / UNION /i,
            / SELECT /i,
            / DROP /i,
            / OR 1=1/i,
            /--/
        ];

        return patterns.some(p => p.test(input));
    }

    // --- HONEYPOT TOKENS ---

    static generateTrapToken(email) {
        return jwt.sign({ email, action: 'blacklist' }, TRAP_SECRET, { expiresIn: '1h' });
    }

    static verifyToken(token) {
        try {
            return jwt.verify(token, TRAP_SECRET);
        } catch (e) {
            return null;
        }
    }
}

module.exports = Security;  