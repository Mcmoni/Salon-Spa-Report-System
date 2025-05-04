
const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  services: [{
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }],
  date: {
    type: Date,
    default: Date.now
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit_card', 'debit_card', 'mobile_money', 'other'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'refunded', 'cancelled'],
    default: 'completed'
  },
  loyaltyPointsEarned: {
    type: Number,
    default: 0
  },
  discountApplied: {
    type: Number,
    default: 0
  },
  receptionist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String
  },
  smsSent: {
    type: Boolean,
    default: false
  },
  smsSentAt: {
    type: Date
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

visitSchema.index({ date: 1 });
visitSchema.index({ client: 1 });
visitSchema.index({ paymentMethod: 1 });
visitSchema.index({ paymentStatus: 1 });
visitSchema.index({ 'services.service': 1 });
visitSchema.index({ receptionist: 1 });

const Visit = mongoose.model('Visit', visitSchema);

module.exports = Visit;
