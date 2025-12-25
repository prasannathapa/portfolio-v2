const express = require('express');
//const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config/config');

const app = express();

// --- MIDDLEWARE ---
//app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(config.FRONTEND_PATH));

// --- API RATE LIMITING ---
// This protects your /api routes (like Request, Portfolio)
// 100 requests per 15 minutes per IP address.
const limiter = rateLimit({ 
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all requests starting with /api
app.use('/api', limiter);

// --- ROUTES ---
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Mount Routes
app.use('/api', publicRoutes);
app.use('/admin', adminRoutes); // Admin routes are usually NOT rate limited (or have higher limits)

// Start Server
app.listen(config.PORT, () => { 
    console.log(`\n🚀 AI Agent Server running on ${config.BASE_URL}`); 
});