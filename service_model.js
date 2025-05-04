const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['hair', 'facial', 'massage', 'nails', 'makeup', 'spa', 'other'],
    default: 'other'
  },
  duration: {
    type: Number, 
    required: true,
    min: 5
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  loyaltyPointsEarned: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

serviceSchema.index({ category: 1 });
serviceSchema.index({ isActive: 1 });

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
