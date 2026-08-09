const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
// ==========================================
// UPDATED DATABASE SCHEMA (n&n Coins & Alpha)
// ==========================================
const UserSchema = new mongoose.Schema({
    uid: { type: String, unique: true, required: true },
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, trim: true },
    gmail: { type: String, required: true, unique: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    
    // 🪙 n&n Wallet Coins (Direct deposits & Game play)
    nn_wallet_balance: { type: Number, default: 0 },
    
    // 🚀 n&n Alpha Crypto (Mining rewards & Exchanged tokens)
    nn_alpha_balance: { type: Number, default: 0 },
    
    // 🤖 Bot Mining Balance (Raw rewards before conversion)
    bot_mining_balance: { type: Number, default: 0 },
    
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// ==========================================
// 2. समय की पाबंदी का लॉजिक (10 AM to 5 PM)
// ==========================================
const checkPaymentTime = (req, res, next) => {
    const now = new Date();
    
    // भारतीय समय (IST) के हिसाब से घंटे निकालना (UTC से IST +5:30)
    const currentISTHour = now.getUTCHours() + 5; 
    const currentISTMinute = now.getUTCMinutes() + 30;
    
    let totalMinutes = (currentISTHour * 60) + currentISTMinute;
    if (currentISTMinute >= 60) totalMinutes += 30; 

    const startMinutes = 10 * 60; // सुबह 10:00 बजे
    const endMinutes = 17 * 60;  // शाम 05:00 बजे

    // अगर कोई डिपॉजिट या विथड्रॉल का रूट हिट करता है (ये रूट्स हम आगे बनाएंगे)
    if (req.path.includes('/deposit') || req.path.includes('/withdraw')) {
        if (totalMinutes < startMinutes || totalMinutes > endMinutes) {
            return res.status(403).json({ 
                success: false, 
                message: "Transactions बंद हैं! कृपया सुबह 10:00 से शाम 05:00 के बीच प्रयास करें।" 
            });
        }
    }
    next();
};

app.use(checkPaymentTime);

// ==========================================
// 3. लॉगिन और रजिस्ट्रेशन एपीआई (AUTH API ROUTES)
// ==========================================

// 🔑 रजिस्ट्रेशन (Sign Up)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { first_name, last_name, gmail, mobile, password, invite_code } = req.body;

        // चेक करें कि यूजर पहले से है या नहीं
        const userExists = await User.findOne({ $or: [{ gmail }, { mobile }] });
        if (userExists) {
            return res.status(400).json({ success: false, message: "Mobile number ya Gmail pehle se registered hai!" });
        }

        // 🆔 एक यूनिक 6-अंकों का डिजिटल UID जनरेट करना (जैसे: CW4829)
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const uid = `CW${randomDigits}`;

        const newUser = new User({
            uid, first_name, last_name, gmail, mobile, password, invite_code, wallet_balance: 0
        });

        await newUser.save();

        res.status(201).json({
            success: true,
            message: "Registration successful!",
            uid: newUser.uid
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error! Kripya dobara koshish karein." });
    }
});

// 🔓 लॉगिन (Sign In)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { login_key, password } = req.body;

        // यूजर को UID, Mobile, या Gmail किसी से भी ढूंढें
        const user = await User.findOne({
            $or: [
                { uid: login_key },
                { mobile: login_key },
                { gmail: login_key }
            ]
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "User nahi mila! Kripya details check karein." });
        }

        // पासवर्ड मैच करना
        if (user.password !== password) {
            return res.status(400).json({ success: false, message: "Galat Password! Kripya sahi password dalein." });
        }

        res.status(200).json({
            success: true,
            message: "Login successful!",
            user: {
                uid: user.uid,
                first_name: user.first_name,
                last_name: user.last_name,
                gmail: user.gmail,
                mobile: user.mobile,
                wallet_balance: user.wallet_balance
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error! Login nahi ho paya." });
    }
});

// 🔍 टेस्ट रूट (सर्वर चेक करने के लिए)
app.get('/', (req, res) => {
    res.send("Central Wallet Server is Running Successfully without folders!");
});
// ==========================================
// API TO FETCH MULTIPLE WALLET BALANCES
// ==========================================
app.get('/api/wallet/balance', async (req, res) => {
    try {
        const { uid } = req.query;
        const user = await User.findOne({ uid });
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        
        // Sending all balances to Dashboard
        res.status(200).json({
            success: true,
            nn_balance: user.nn_wallet_balance,
            alpha_balance: user.nn_alpha_balance,
            bot_balance: user.bot_mining_balance
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Internal server error during balance sync" });
    }
});

// ==========================================
// 4. मोंगोडीबी कनेक्शन और सर्वर स्टार्ट
// ==========================================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected Successfully!"))
.catch(err => console.error("Database Connection Error:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
