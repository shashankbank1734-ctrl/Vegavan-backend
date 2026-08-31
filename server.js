require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for the public embed script
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Root Route
app.get('/', (req, res) => {
  res.send('Hello from Backend!');
});

// Serve Static Files from public (For the chatbot.js embed script)
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-chatbot-saas';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB successfully connected.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Route Imports
const authRoutes = require('./routes/auth');
const chatbotRoutes = require('./routes/chatbot');
const chatRoutes = require('./routes/chat');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// ==========================================
// SOCKET.IO REAL-TIME CHAT OPERATIONS
// ==========================================
const ChatbotConfig = require('./models/ChatbotConfig');
const KnowledgeBase = require('./models/KnowledgeBase');
const Conversation = require('./models/Conversation');
const User = require('./models/User');

const queryGroq = async (message, systemPrompt, history) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('Groq Error: GROQ_API_KEY is not defined.');
    return null;
  }

  try {
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ];

    console.log('Querying Groq with formatted messages count:', formattedMessages.length);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: formattedMessages,
        temperature: 0.2
      })
    });

    const data = await res.json();
    if (res.ok && data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    }

    console.error('Groq API HTTP Error Status:', res.status, res.statusText);
    console.error('Groq API Error Response Data:', JSON.stringify(data, null, 2));
    return null;
  } catch (err) {
    console.error('Groq Error Exception:', err);
    return null;
  }
};

const extractActualUrl = (link) => {
  try {
    if (!link) return '';
    const match = link.match(/[?&]uddg=([^&]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    if (link.startsWith('http')) return link;
    return '';
  } catch (err) {
    return '';
  }
};

const searchWeb = async (query) => {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return '';
    const html = await res.text();
    
    const snippets = [];
    const regex = /<a class="result__snippet"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null && snippets.length < 5) {
      const ddgLink = match[1];
      const actualUrl = extractActualUrl(ddgLink);
      const cleanSnippet = match[2].replace(/<[^>]*>/g, '').trim();
      if (cleanSnippet) {
        if (actualUrl) {
          snippets.push(`Website URL: ${actualUrl}\nAbout: ${cleanSnippet}`);
        } else {
          snippets.push(cleanSnippet);
        }
      }
    }
    return snippets.join('\n\n');
  } catch (err) {
    console.error('Web Search Scraper Error:', err.message);
    return '';
  }
};

io.on('connection', (socket) => {
  console.log('New WebSocket connection established:', socket.id);

  // Join a unique chat session room
  socket.on('join_session', ({ sessionId }) => {
    if (sessionId) {
      socket.join(sessionId);
      console.log(`Socket ${socket.id} joined room: ${sessionId}`);
    }
  });

  socket.on('send_message', async ({ userId, message, sessionId, visitorName, visitorPhone }) => {
    try {
      if (!userId || !message) {
        return socket.emit('error', { message: 'userId and message are required' });
      }

      const activeSessionId = sessionId || 'session_' + Math.random().toString(36).substring(2, 15);
      socket.join(activeSessionId);

      // Check plan limits
      let user = null;
      try {
        user = await User.findById(userId);
      } catch (e) {}

      if (user) {
        const plan = user.plan || 'Starter';
        const limit = plan === 'Starter' ? 1000 : plan === 'Professional' ? 5000 : Infinity;
        if (user.messageCount >= limit) {
          return io.to(activeSessionId).emit('receive_message', {
            role: 'assistant',
            content: `⚠️ Quota Exceeded: You have reached the monthly limit of ${limit.toLocaleString()} messages on your ${plan} plan. Please upgrade your subscription to resume automated responses.`,
            sessionId: activeSessionId,
            quotaExceeded: true
          });
        }
      }

      // 1. Fetch chatbot configuration
      const config = await ChatbotConfig.findOne({ userId }) || {
        businessName: 'Support',
        supportEmail: 'support@example.com',
        supportPhone: '',
        tone: 'friendly',
        systemPrompt: 'You are a helpful customer support agent.',
        welcomeMessage: 'Hi! How can I help you?'
      };

      // 2. Fetch Knowledge Base context
      const knowledgeBlocks = await KnowledgeBase.find({ userId });
      
      // Simple word match score to filter context
      const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      let context = '';
      if (words.length > 0 && knowledgeBlocks.length > 0) {
        const matches = knowledgeBlocks.map(kb => {
          let score = 0;
          const contentLower = kb.content.toLowerCase();
          words.forEach(w => { if (contentLower.includes(w)) score++; });
          return { kb, score };
        }).filter(item => item.score > 0).sort((a,b) => b.score - a.score);
        
        context = matches.length > 0 
          ? matches.slice(0, 5).map(item => item.kb.content).join('\n\n')
          : knowledgeBlocks.slice(0, 3).map(kb => kb.content).join('\n\n');
      } else if (knowledgeBlocks.length > 0) {
        context = knowledgeBlocks.slice(0, 5).map(kb => kb.content).join('\n\n');
      }

      // Dynamic Live Web Search Fallback RAG over WebSockets
      if (!context || context.trim() === '') {
        console.log(`No local context found in WebSockets. Initiating dynamic web search for: ${config.businessName} ${message}`);
        const webResults = await searchWeb(`${config.businessName} ${message}`);
        if (webResults) {
          context = `[Live Web Search Grounding Data]:\n${webResults}`;
        }
      }

      // 3. System Instructions
      const systemPrompt = `
You are the AI customer support chatbot for "${config.businessName}".
Your support email is "${config.supportEmail}".
${config.supportPhone ? `Your support phone number is "${config.supportPhone}".` : ''}
Your communication tone must be: "${config.tone}".

Your instructions:
- ${config.systemPrompt}
${visitorName ? `- The active visitor's name is "${visitorName}". Address them by their name to make the conversation personal and engaging.` : ''}
- You must use the following Business Knowledge context to answer customer questions accurately.
- Keep your answers extremely short, informative, clear, and easy to understand (max 2-3 brief sentences). Avoid long paragraphs or blocks of text entirely.
- If the customer asks for a phone number or email, provide them directly and concisely: Email: "${config.supportEmail}"${config.supportPhone ? `, Phone: "${config.supportPhone}"` : ''}.
- Do NOT make up answers if they are not in the context. If the customer asks for a phone number, contact details, or specific locations that are not in the context, politely and briefly ask them to leave their name, phone number, and requirements here in the chat so that a representative from "${config.businessName}" can contact them immediately.

BUSINESS KNOWLEDGE CONTEXT:
${context || 'No business data available.'}
`;

      const phoneRegex = /^\d{10}$/;
      const validPhone = (visitorPhone && phoneRegex.test(visitorPhone)) ? visitorPhone : '';

      // 4. Fetch history
      let conversation = await Conversation.findOne({ userId, sessionId: activeSessionId });
      if (!conversation) {
        conversation = new Conversation({ 
          userId, 
          sessionId: activeSessionId, 
          messages: [],
          visitorName: visitorName || '',
          visitorPhone: validPhone
        });
      } else {
        if (visitorName) conversation.visitorName = visitorName;
        if (validPhone) conversation.visitorPhone = validPhone;
      }

      const history = conversation.messages.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // 5. Query Groq AI
      let aiResponseText = '';
      const groqKey = process.env.GROQ_API_KEY;

      if (groqKey) {
        console.log('Socket: Querying Groq (Llama 3.3)...');
        const groqText = await queryGroq(message, systemPrompt, history);
        if (groqText) {
          aiResponseText = groqText;
        } else {
          aiResponseText = `⚠️ [AI Error] I encountered an error while communicating with Groq.`;
        }
      } else {
        aiResponseText = `[Demo Mode] I received your message: "${message}". Connect your GROQ_API_KEY to enable live AI. Reach us at ${config.supportEmail}.`;
      }

      // 6. Log conversation
      conversation.messages.push({ role: 'user', content: message });
      conversation.messages.push({ role: 'assistant', content: aiResponseText });
      await conversation.save();

      // Increment message count
      if (user) {
        user.messageCount = (user.messageCount || 0) + 1;
        await user.save();
      }

      // Emit responses back to active clients in session
      io.to(activeSessionId).emit('receive_message', {
        role: 'assistant',
        content: aiResponseText,
        sessionId: activeSessionId
      });

    } catch (err) {
      console.error('Socket message error:', err.message);
      socket.emit('error', { message: 'Server WebSocket Error' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Listen Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend Express Server is running on port ${PORT}`);
});
