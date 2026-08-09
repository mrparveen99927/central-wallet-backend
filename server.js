const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ==========================================
// 1. MIDDLEWARES (       )
// ==========================================
app.use(express.json());
app.use(cors({
  origin: '*', //       ( GitHub Pages)       
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


// ==========================================
// 2. MONGODB CONNECTION ( )
// ==========================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log(' MongoDB "center-wallet" Connected Successfully!'))
  .catch(err => console.error(' MongoDB Connection Failed:', err));

// ==========================================
// 3. DATABASE SCHEMA FOR USERS (   )
// ==========================================
const UserSchema = new mongoose.Schema({
  uid: { 
    type: String, 
    required: true, 
    unique: true 
  }, //       (6  )
  firstName: { 
    type: String, 
    required: true, 
    trim: true 
  },
  lastName: { 
    type: String, 
    default: "" 
  }, //   
  mobile: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  }, //     
  email: { 
    type: String, 
    default: "", 
    trim: true 
  }, //   
  password: { 
    type: String, 
    required: true 
  }, //  
  balance: { 
    type: Number, 
    default: 0 
  }, //    0 
  myReferralCode: { 
    type: String, 
    unique: true 
  }, //       
  referredBy: { 
    type: String, 
    default: "" 
  } //      ()
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
// ==========================================
// 3.B LIVE CHAT & TRANSACTION HISTORY SCHEMA
// ==========================================
const MessageSchema = new mongoose.Schema({
    senderUid: { type: String, required: true },
    receiverUid: { type: String, required: true },
    type: { type: String, enum: ['text', 'payment'], required: true }, // text  payment
    content: { type: String, required: true }, //     
    status: { type: String, default: "Successful" }
}, { timestamps: true });

const Message = mongoose.model('Message', MessageSchema);
// ==========================================
// 4. AUTHENTICATION APIS (REGISTRATION & LOGIN)
// ==========================================

// API 1:    (Registration Route)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, mobile, email, password, referralCode } = req.body;

    //           
    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "This mobile number is already registered! Please log in." 
      });
    }

    //  6-   UID  
    let uniqueUid;
    let isUidUnique = false;
    while (!isUidUnique) {
      uniqueUid = Math.floor(100000 + Math.random() * 900000).toString();
      const checkUid = await User.findOne({ uid: uniqueUid });
      if (!checkUid) isUidUnique = true;
    }

    //           (First Name + 4  )
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const generatedReferralCode = `${firstName.substring(0, 4).toUpperCase()}${randomDigits}`;

    //     
    const newUser = new User({
      uid: uniqueUid,
      firstName,
      lastName: lastName || "",
      mobile,
      email: email || "",
      password, 
      myReferralCode: generatedReferralCode,
      referredBy: referralCode || ""
    });

    //    
    await newUser.save();

    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      data: {
        uid: newUser.uid,
        firstName: newUser.firstName,
        mobile: newUser.mobile,
        myReferralCode: newUser.myReferralCode
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API 2:   (Login Route - UID, Mobile  Email    )
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // UID,           
    const user = await User.findOne({
      $or: [
        { uid: identifier },
        { mobile: identifier },
        { email: identifier }
      ]
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "No account found with this UID, Mobile, or Email." 
      });
    }

    //   
    if (user.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: "Incorrect password! Please try again." 
      });
    }

    //  
    res.status(200).json({
      success: true,
      message: "Login successful!",
      user: {
        uid: user.uid,
        firstName: user.firstName,
        lastName: user.lastName,
        mobile: user.mobile,
        balance: user.balance
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
//   server.js        (Replace)  
app.get('/api/user/search', async (req, res) => {
    try {
        let { query } = req.query;
        if (!query) {
            return res.status(400).json({ success: false, message: "Search query is required." });
        }

        //     (Trim )
        query = query.trim();

        //   :     UPI ID   ( @central  )
        if (query.includes('@')) {
            //  '@'     (   )    
            query = query.split('@')[0];
        }

        //        UID      
        const targetUser = await User.findOne({
            $or: [
                { mobile: query },
                { uid: query }
            ]
        });

        if (!targetUser) {
            return res.status(404).json({ success: false, message: "No registered user found." });
        }

        //      
        res.status(200).json({
            success: true,
            user: {
                uid: targetUser.uid,
                firstName: targetUser.firstName,
                lastName: targetUser.lastName,
                mobile: targetUser.mobile,
                upiId: `${targetUser.mobile}@central`
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// API 4:       (100%    )
app.post('/api/wallet/transfer', async (req, res) => {
    // 1.            'Processing'    
    const newTransactionLog = new Message({
        senderUid: req.body.senderUid,
        receiverUid: req.body.receiverUid,
        type: 'payment',
        content: req.body.amount ? req.body.amount.toString() : "0",
        status: 'Processing' //       
    });

    try {
        const { senderUid, receiverUid, amount } = req.body;

        //   1:         ?
        if (!senderUid || !receiverUid || !amount || Number(amount) <= 0) {
            newTransactionLog.status = 'Failed';
            await newTransactionLog.save();
            return res.status(400).json({ success: false, message: "Invalid parameters or amount." });
        }

        //           
        const sender = await User.findOne({ uid: senderUid });
        const receiver = await User.findOne({ uid: receiverUid });

        //   2:         ?
        if (!sender || !receiver) {
            newTransactionLog.status = 'Failed';
            await newTransactionLog.save();
            return res.status(444).json({ success: false, message: "Sender or Receiver wallet account not found." });
        }

        //   3:          ?
        const transferAmount = Number(amount);
        if (sender.balance < transferAmount) {
            newTransactionLog.status = 'Failed';
            await newTransactionLog.save();
            return res.status(400).json({ success: false, message: "Declined: Insufficient wallet balance." });
        }

        //     :
        //                
        sender.balance = sender.balance - transferAmount;
        receiver.balance = receiver.balance + transferAmount;

        //         
        await sender.save();
        await receiver.save();
const realUTR = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        const realTransferID = "TXN-" + Math.random().toString(36).substring(2, 10).toUpperCase();
        //  :        'Successful'    
        newTransactionLog.status = 'Successful';
        await newTransactionLog.save();

        //      
        return res.status(200).json({
            success: true,
            message: "Transaction completed successfully.",
            data: newTransactionLog
        });

    } catch (error) {
        console.error("block    :", error);
        
        //              'Failed'  
        newTransactionLog.status = 'Failed';
        try {
            await newTransactionLog.save();
        } catch (dbErr) {
            console.log("      :", dbErr);
        }
        
        return res.status(500).json({ 
            success: false, 
            message: "Transaction failed due to internal connection drop." 
        });
    }
});

// ==========================================
// 5.B LIVE CHAT & TRANSACTION HISTORY FETCH API
// ==========================================
//         -       
app.get('/api/chat/history', async (req, res) => {
    try {
        const { senderUid, receiverUid } = req.query;

        if (!senderUid || !receiverUid) {
            return res.status(400).json({ success: false, message: "Both senderUid and receiverUid are required." });
        }

        //   :    A  B   ,  B  A   
        const logs = await Message.find({
            $or: [
                { senderUid: senderUid, receiverUid: receiverUid },
                { senderUid: receiverUid, receiverUid: senderUid }
            ]
        }).sort({ createdAt: 1 }); //     (    )  

        res.status(200).json({
            success: true,
            history: logs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// API 6:           (New)
app.get('/api/wallet/history', async (req, res) => {
    try {
        const { uid } = req.query;
        if (!uid) {
            return res.status(400).json({ success: false, message: "User Identity (uid) is required." });
        }

        //         sender   receiver ,   'payment' 
        const walletHistory = await Message.find({
            type: 'payment',
            $or: [
                { senderUid: uid },
                { receiverUid: uid }
            ]
        }).sort({ createdAt: -1 }); // -1         

        res.status(200).json({
            success: true,
            message: "Wallet passbook logs fetched successfully.",
            history: walletHistory
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 5.C LIVE TEXT MESSAGE SEND API
// ==========================================
//              
// API 5:            
app.post('/api/chat/send', async (req, res) => {
    try {
        const { senderUid, receiverUid, content, type } = req.body;
        if (!senderUid || !receiverUid || !content) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }
        
        const newMessage = new Message({
            senderUid,
            receiverUid,
            type: type || 'text', //       'text' ,    'payment' 
            content: content.trim(),
            status: 'Successful'
        });
        
        await newMessage.save();
        res.status(200).json({
            success: true,
            message: "Logged into database successfully!",
            data: newMessage
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API 5:          (Live Sync Route)
app.get('/api/user/:uid', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.uid });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        res.status(200).json({
            success: true,
            user: {
                uid: user.uid,
                firstName: user.firstName,
                lastName: user.lastName,
                mobile: user.mobile,
                balance: user.balance
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 5. SERVER INITIALIZATION (    )
// ==========================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(` Server is running smoothly on port ${PORT}`);
});
