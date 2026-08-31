const mongoose = require('mongoose');

const ChatbotConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  businessName: {
    type: String,
    default: 'My SaaS Assistant'
  },
  supportEmail: {
    type: String,
    default: 'support@example.com'
  },
  supportPhone: {
    type: String,
    default: ''
  },
  tone: {
    type: String,
    enum: ['friendly', 'professional', 'sales'],
    default: 'friendly'
  },
  systemPrompt: {
    type: String,
    default: 'You are an advanced customer support AI assistant. Answer questions truthfully and politely based on the provided knowledge. If the answer cannot be found in the knowledge base, ask the user to leave their contact details or send an email.'
  },
  primaryColor: {
    type: String,
    default: '#ffffff' // White
  },
  welcomeMessage: {
    type: String,
    default: 'Hello! I am your AI Assistant. How can I help you today?'
  }
}, { timestamps: true });

module.exports = mongoose.model('ChatbotConfig', ChatbotConfigSchema);
