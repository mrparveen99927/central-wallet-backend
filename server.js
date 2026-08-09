const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. DATABASE SCHEMA (Strictly for central_wallet_db)
// ==========================================
const UserSchema = new mongoose.Schema({
    uid: { type: String, unique: true, required: true },
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, trim: true },
    gmail: { type: String, required: true, unique: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true }, 
    nn_wallet_balance: { type: Number, default: 0 },
    nn_alpha_balance: { type: Number, default: 0 },
    bot_mining_balance: { type: Number, default: 0 },
    invite_code: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'users' }); 

const User = mongoose.model('User', UserSchema);

// ==========================================
// 2. IST TIME BOUND LOGIC (10 AM to 5 PM)
// ==========================================
const checkPaymentTime = (req, res, next) => {
    const now = new Date();
    const localTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const currentISTHour = localTime.getUTCHours();
    const currentISTMinute = localTime.getUTCMinutes();
    
    const totalMinutes = (currentISTHour * 60) + currentISTMinute;
    const startMinutes = 10 * 60; // 10:00 AM
    const endMinutes = 17 * 60;   // 05:00 PM

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
// 3. AUTH API ROUTES
// ==========================================

// 🔑 Registration (Sign Up)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { first_name, last_name, gmail, mobile, password, invite_code } = req.body;

        const userExists = await User.findOne({ $or: [{ gmail }, { mobile }] });
        if (userExists) {
            return res.status(400).json({ success: false, message: "Mobile number ya Gmail pehle se registered hai!" });
        }

        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const uid = `CW${randomDigits}`;

        const newUser = new User({
            uid, first_name, last_name, gmail, mobile, password, invite_code,
            nn_wallet_balance: 0,
            nn_alpha_balance: 0,
            bot_mining_balance: 0
        });

        await newUser.save();
        res.status(201).json({ success: true, message: "Registration successful!", uid: newUser.uid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error! Kripya dobara koshish karein." });
    }
});

// 🔓 Login (Sign In)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { login_key, password } = req.body;

        const user = await User.findOne({
            $or: [{ uid: login_key }, { mobile: login_key }, { gmail: login_key }]
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "User nahi mila!" });
        }

        if (user.password !== password) {
            return res.status(400).json({ success: false, message: "Galat Password!" });
        }

        res.status(200).json({
            success: true,
            message: "Login successful!",
            user: { uid: user.uid, first_name: user.first_name, last_name: user.last_name, gmail: user.gmail, mobile: user.mobile, nn_wallet_balance: user.nn_wallet_balance }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error!" });
    }
});

// 🪙 FETCH WALLET BALANCES
app.get('/api/wallet/balance', async (req, res) => {
    try {
        const { uid } = req.query;
        const user = await User.findOne({ uid });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.status(200).json({
            success: true,
            nn_balance: user.nn_wallet_balance,
            alpha_balance: user.nn_alpha_balance,
            bot_balance: user.bot_mining_balance
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// 🎯 SECRET DATABASE CHECK ROUTE (यह आपका वापस आ गया भाई!)
app.get('/api/secret-database-check-123', async (req, res) => {
    try {
        const allUsers = await User.find({});
        res.status(200).json({
            success: true,
            total_users_in_database: allUsers.length,
            users: allUsers
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/', (req, res) => {
    res.send("Central Wallet Server is Running Successfully!");
});

// ==========================================
// 4. DATABASE CONNECTION
// ==========================================
const DB_URL = process.env.MONGO_URI || "mongodb+srv://game_user:Nnalpha999@cluster0.garubng.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(DB_URL, {
    dbName: 'central_wallet_db' // 🎯 जबरदस्ती इसी डेटाबेस फोल्डर में डेटा लॉक करने के लिए
})
.then(() => console.log("MongoDB Connected Successfully to central_wallet_db!"))
.catch(err => console.error("Database Connection Error:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
