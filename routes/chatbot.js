const express = require('express');
const router = express.Router();
const ChatbotConfig = require('../models/ChatbotConfig');
const KnowledgeBase = require('../models/KnowledgeBase');
const Conversation = require('../models/Conversation');
const authMiddleware = require('../middleware/auth');

// ==========================================
// CHATBOT CONFIGURATION ROUTES
// ==========================================

// @route   GET /api/chatbot/config
// @desc    Get user's chatbot settings (dashboard)
router.get('/config', authMiddleware, async (req, res) => {
  try {
    let config = await ChatbotConfig.findOne({ userId: req.user.id });
    if (!config) {
      config = new ChatbotConfig({ userId: req.user.id });
      await config.save();
    }
    res.json(config);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/chatbot/config
// @desc    Update chatbot settings
router.post('/config', authMiddleware, async (req, res) => {
  const { businessName, supportEmail, supportPhone, tone, systemPrompt, primaryColor, welcomeMessage } = req.body;

  try {
    let config = await ChatbotConfig.findOne({ userId: req.user.id });
    if (!config) {
      config = new ChatbotConfig({ userId: req.user.id });
    }

    if (businessName) config.businessName = businessName;
    if (supportEmail) config.supportEmail = supportEmail;
    if (supportPhone !== undefined) config.supportPhone = supportPhone;
    if (tone) config.tone = tone;
    if (systemPrompt) config.systemPrompt = systemPrompt;
    if (primaryColor) config.primaryColor = primaryColor;
    if (welcomeMessage) config.welcomeMessage = welcomeMessage;

    await config.save();
    res.json(config);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/chatbot/config/public
// @desc    Public endpoint to load styling on external client widget (unprotected)
router.get('/config/public', async (req, res) => {
  const { userId } = req.query;

  try {
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    let config = await ChatbotConfig.findOne({ userId });
    if (!config || userId === '69fad2cb361347e3ca9d17fc') {
      const latestConfig = await ChatbotConfig.findOne().sort({ updatedAt: -1 });
      if (latestConfig) {
        config = latestConfig;
      }
    }
    if (!config) {
      return res.status(404).json({ message: 'Chatbot configuration not found' });
    }

    res.json(config);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ==========================================
// KNOWLEDGE BASE ROUTES
// ==========================================

// @route   GET /api/chatbot/knowledge
// @desc    Get all knowledge blocks
router.get('/knowledge', authMiddleware, async (req, res) => {
  try {
    const knowledge = await KnowledgeBase.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(knowledge);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/chatbot/knowledge
// @desc    Create a new knowledge block
router.post('/knowledge', authMiddleware, async (req, res) => {
  const { content, source } = req.body;

  try {
    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const newKnowledge = new KnowledgeBase({
      userId: req.user.id,
      content,
      source: source || 'Manual Input'
    });

    await newKnowledge.save();
    res.json(newKnowledge);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/chatbot/knowledge/:id
// @desc    Delete a knowledge block
router.delete('/knowledge/:id', authMiddleware, async (req, res) => {
  try {
    const knowledge = await KnowledgeBase.findOne({ _id: req.params.id, userId: req.user.id });
    if (!knowledge) {
      return res.status(404).json({ message: 'Knowledge item not found' });
    }

    await knowledge.deleteOne();
    res.json({ message: 'Knowledge item removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ==========================================
// ANALYTICS ROUTE
// ==========================================

// @route   GET /api/chatbot/analytics
// @desc    Get aggregated SaaS metrics
router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Total conversations
    const totalConversations = await Conversation.countDocuments({ userId });

    // 2. Total messages exchanged
    const conversations = await Conversation.find({ userId });
    let totalMessages = 0;
    conversations.forEach(c => {
      totalMessages += c.messages.length;
    });

    // 3. Active sessions (unique sessionIds)
    const activeSessions = await Conversation.distinct('sessionId', { userId });
    const totalActiveUsers = activeSessions.length;

    // 4. Generate real timeline data based on actual logs for charts
    // Create a 7-day list ending today
    const timeline = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      // Filter conversations created on this day
      const dayStart = new Date(d.getTime());
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(d.getTime());
      dayEnd.setHours(23, 59, 59, 999);

      const dayConvs = conversations.filter(c => {
        const cDate = new Date(c.createdAt);
        return cDate >= dayStart && cDate <= dayEnd;
      });

      let dayMsgs = 0;
      dayConvs.forEach(c => dayMsgs += c.messages.length);

      timeline.push({
        date: dateStr,
        chats: dayConvs.length,
        messages: dayMsgs
      });
    }

    res.json({
      totalConversations,
      totalMessages,
      totalActiveUsers,
      timeline
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/chatbot/leads
// @desc    Get all captured visitor leads from pre-chat forms
router.get('/leads', authMiddleware, async (req, res) => {
  try {
    const leads = await Conversation.find({ 
      userId: req.user.id,
      visitorName: { $exists: true, $ne: '' },
      visitorPhone: { $exists: true, $ne: '' }
    }).sort({ updatedAt: -1 }).select('visitorName visitorPhone createdAt messages');
    
    const cleanLeads = leads.map(l => ({
      _id: l._id,
      name: l.visitorName,
      phone: l.visitorPhone,
      createdAt: l.createdAt,
      lastMessage: l.messages.length > 0 ? l.messages[l.messages.length - 1].content : ''
    }));

    res.json(cleanLeads);
  } catch (err) {
    console.error('Fetch leads error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/chatbot/leads/:id
// @desc    Delete an individual visitor lead (conversation)
router.delete('/leads/:id', authMiddleware, async (req, res) => {
  try {
    const lead = await Conversation.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    await lead.deleteOne();
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    console.error('Delete lead error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/chatbot/leads
// @desc    Delete all visitor leads for the authenticated user
router.delete('/leads', authMiddleware, async (req, res) => {
  try {
    await Conversation.deleteMany({
      userId: req.user.id,
      visitorName: { $exists: true, $ne: '' },
      visitorPhone: { $exists: true, $ne: '' }
    });

    res.json({ message: 'All leads deleted successfully' });
  } catch (err) {
    console.error('Delete all leads error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
