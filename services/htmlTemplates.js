// 1. User Email (Notification)
const generateUserEmail = (aiBodyContent, unsubscribeLink) => `
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

// 2. Admin Summary Email
const generateAdminSummaryEmail = (userDetails, originalMessage, aiResponseHtml, attachedResume, adminLink) => `
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

// 3. The "Got It" Unsubscribe Page (Human Tone)
const generateUnsubscribePage = (email, returnLink) => `
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f9fafb; color: #111; }
        .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); text-align: center; max-width: 450px; }
        .btn { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #111; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; }
        h1 { font-size: 24px; margin-bottom: 10px; }
        p { color: #555; line-height: 1.6; }
    </style>
    <div class="card">
        <h1>Appologies!</h1>
        <p>I'll refrain from mailing to <b>${email}</b>.</p>
        <p style="font-size: 0.9em; margin-top: 20px; color: #888;">
            Mistake? You can click the button below (or the link I just emailed you) to restart anytime.
        </p>
        <a href="${returnLink}" class="btn">Re-enable</a>
    </div>`;

// 4. The "Welcome Back" Page
const generateWhitelistPage = (email) => `
    <style>body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; }</style>
    <div>
        <h1>Welcome back! 👋</h1>
        <p>I've re-enabled access for <b>${email}</b>.</p>
        <p>You can close this tab.</p>
    </div>`;

// 5. The "Eternal" Return Token Email
const generateReturnTokenEmail = (returnLink) => `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <p>Hey,</p>
        <p>Just confirming that <b>I've stopped sending automated emails</b> to this address.</p>
        <p>If you ever want to see my updates or access the portfolio again, just click this link:</p>
        <p><a href="${returnLink}">Resume Access / Restart Emails</a></p>
        <p>Best,<br>Prasanna</p>
    </div>`;

// 6. The Improved Admin Dashboard HTML
const generateAdminDashboard = (rows, token) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Control</title>
    <style>
        :root { --bg: #f8f9fa; --surface: #ffffff; --border: #e9ecef; --text: #212529; --text-muted: #6c757d; --primary: #0f172a; --danger: #dc3545; --success: #198754; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; margin: 0; }
        .container { max-width: 1000px; margin: 0 auto; background: var(--surface); border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); overflow: hidden; }
        .header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .header h1 { margin: 0; font-size: 1.25rem; font-weight: 600; }
        .controls { padding: 1rem 2rem; background: #fafafa; border-bottom: 1px solid var(--border); }
        .search-input { width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; outline: none; box-sizing: border-box; }
        .table-wrapper { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { padding: 1rem 1.5rem; background: #f8f9fa; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--border); }
        td { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .user-name { font-weight: 600; color: var(--primary); display: block; }
        .user-email { font-size: 0.85rem; color: var(--text-muted); }
        .uuid { font-family: monospace; background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: var(--text-muted); }
        .badge { padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; display: inline-block; }
        .bg-red { background: #ffebeb; color: #ca2b2b; } 
        .bg-green { background: #e6f8f0; color: #0f7a46; } 
        .bg-gray { background: #f1f3f5; color: #495057; } 
        .bg-gold { background: #fff3cd; color: #856404; } 
        .actions { display: flex; gap: 10px; align-items: center; }
        select { padding: 6px 10px; border-radius: 6px; border: 1px solid #ced4da; cursor: pointer; background: white; }
        .btn-delete { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 6px; transition: all 0.2s; font-size: 0.85rem; }
        .btn-delete:hover { color: var(--danger); background: #fff5f5; border-radius: 4px; }
        #toast { position: fixed; bottom: 20px; right: 20px; background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transform: translateY(100px); opacity: 0; transition: all 0.3s ease; }
        #toast.show { transform: translateY(0); opacity: 1; }
    </style>
</head>
<body>
<div class="container">
    <div class="header"><h1>🛡️ User Management</h1><div style="font-size: 0.85rem; color: #888;">Live View</div></div>
    <div class="controls"><input type="text" id="searchInput" class="search-input" placeholder="Search by name, email or UUID..."></div>
    <div class="table-wrapper">
        <table>
            <thead><tr><th style="width: 30%">User Profile</th><th style="width: 20%">UUID</th><th style="width: 15%">Access Level</th><th style="width: 35%">Actions</th></tr></thead>
            <tbody id="tableBody">${rows}</tbody>
        </table>
    </div>
</div>
<div id="toast">Action Successful</div>
<script>
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.user-row').forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    });
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('msg')) {
        const t = document.getElementById('toast');
        const m = urlParams.get('msg');
        if(m==='updated') t.innerText='✅ Access Level Updated'; if(m==='deleted') t.innerText='🗑️ User Deleted';
        t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000);
        window.history.replaceState({},document.title,window.location.pathname+"?token=${token}");
    }
</script>
</body>
</html>`;

module.exports = {
    generateUserEmail,
    generateAdminSummaryEmail,
    generateUnsubscribePage,
    generateWhitelistPage,
    generateReturnTokenEmail,
    generateAdminDashboard
};