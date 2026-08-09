const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // पासवर्ड सुरक्षा के लिए
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
}, { collection: 'users' }); // 🎯 इसी users कलेक्शन में डेटा जाएगा

const User = mongoose.model('User', UserSchema);

// ==========================================
// 2. AUTH ROUTES (Register & Login)
// ==========================================

// 🔑 Register Route
app.post('/api/auth/register', async (req, res) => {
    try {
        const { first_name, last_name, gmail, mobile, password, invite_code } = req.body;

        // पहले से मौजूद यूजर चेक करना
        const userExists = await User.findOne({ $or: [{ gmail }, { mobile }] });
        if (userExists) {
            return res.status(400).json({ success: false, message: "Mobile number ya Gmail pehle se registered hai!" });
        }

        // यूनिक UID जनरेट करना (e.g., CW1234)
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const uid = `CW${randomDigits}`;

        // पासवर्ड हैश करना
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            uid, first_name, last_name, gmail, mobile, password: hashedPassword, invite_code
        });

        await newUser.save();
        res.status(201).json({ success: true, message: "Registration successful!", uid: newUser.uid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error! Kripya dobara koshish karein." });
    }
});

// 🔓 Login Route
app.post('/api/auth/login', async (req, res) => {
    try {
        const { login_key, password } = req.body;

        const user = await User.findOne({
            $or: [{ uid: login_key }, { mobile: login_key }, { gmail: login_key }]
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "User nahi mila!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Galat Password!" });
        }

        res.status(200).json({
            success: true,
            message: "Login successful!",
            user: { uid: user.uid, first_name: user.first_name, last_name: user.last_name, gmail: user.gmail, mobile: user.mobile }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error during login." });
    }
});

// 🪙 Fetch Balance Route
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

// ==========================================
// 3. DATABASE CONNECTION (Locked to central_wallet_db)
// ==========================================
// पुराना कोड हटाकर इसे डालिए:
const DB_URL = process.env.MONGO_URI || "mongodb+srv://game_user:Nnalpha999@cluster0.garubng.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(DB_URL, {
    dbName: 'central_wallet_db' // 🎯 यह लाइन मोंगोस को मजबूर करेगी कि वह डेटा इसी नाम के अंदर डाले!
})
.then(() => console.log("MongoDB Connected Strictly to central_wallet_db!"))
.catch(err => console.error("Database Connection Error:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
