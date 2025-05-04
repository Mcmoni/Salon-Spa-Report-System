const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.'],
    sparse: true 
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer not to say'],
    default: 'prefer not to say'
  },
  birthdate: {
    type: Date
  },
  address: {
    street: String,
    city: String,
    state: String,
    zip: String
  },
  notes: {
    type: String
  },
  marketingConsent: {
    type: Boolean,
    default: false
  },
  visitCount: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  membershipLevel: {
    type: String,
    enum: ['standard', 'silver', 'gold', 'platinum'],
    default: 'standard'
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

clientSchema.index({ phone: 1 });
clientSchema.index({ lastName: 1, firstName: 1 });

clientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

clientSchema.methods.updateMembershipLevel = function() {
  if (this.visitCount >= 30) {
    this.membershipLevel = 'platinum';
  } else if (this.visitCount >= 20) {
    this.membershipLevel = 'gold';
  } else if (this.visitCount >= 10) {
    this.membershipLevel = 'silver';
  } else {
    this.membershipLevel = 'standard';
  }
  return this.membershipLevel;
};

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;
