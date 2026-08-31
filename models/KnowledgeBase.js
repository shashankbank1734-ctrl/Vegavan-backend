const mongoose = require('mongoose');

const KnowledgeBaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: [true, 'Knowledge content is required']
  },
  source: {
    type: String,
    default: 'Manual FAQ'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('KnowledgeBase', KnowledgeBaseSchema);
