const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ChatbotConfig = require('../models/ChatbotConfig');
const authMiddleware = require('../middleware/auth');
const nodemailer = require('nodemailer');

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || 'super_secret_jwt_token_for_saas_platform_12345',
    { expiresIn: '7d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register user & create default chatbot config
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    user = new User({ email, password });
    await user.save();

    // Generate Default Chatbot Settings for this user
    const defaultConfig = new ChatbotConfig({
      userId: user._id,
      businessName: email.split('@')[0].toUpperCase() + ' Help',
      supportEmail: email,
      tone: 'friendly'
    });
    await defaultConfig.save();

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, plan: user.plan, messageCount: user.messageCount }
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user._id, email: user.email, plan: user.plan, messageCount: user.messageCount }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/auth/me
// @desc    Get user data
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Generate OTP and send reset email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return res.status(200).json({ message: 'If an account exists with this email, a reset link has been sent.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save to user with 15 mins expiration
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // Console log for easy local testing
    console.log(`\n============================`);
    console.log(`PASSWORD RESET OTP FOR ${email}: ${otp}`);
    console.log(`============================\n`);

    // Send Email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Password Reset OTP - AI Chatbot Platform',
        text: `You requested a password reset. Your OTP is: ${otp}\n\nIt expires in 15 minutes.\nIf you didn't request this, please ignore this email.`
      };

      await transporter.sendMail(mailOptions);
    } else {
      console.log('Email credentials not found in .env. Skipping actual email dispatch.');
    }

    res.status(200).json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/reset-password
// @desc    Verify OTP and update password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ 
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Update password (pre-save hook will hash it)
    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    res.json({ message: 'Password has been successfully reset' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
