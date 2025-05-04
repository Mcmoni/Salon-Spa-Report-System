const express = require('express');
const Visit = require('../models/Visit');
const Client = require('../models/Client');
const Service = require('../models/Service');
const { sendThankYouSMS } = require('../services/sms/hubtelService');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'date', 
      sortOrder = 'desc',
      startDate,
      endDate,
      client,
      paymentMethod,
      paymentStatus,
      service
    } = req.query;
    
    let query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
        query.date.$lte.setHours(23, 59, 59, 999);
      }
    }
    
    if (client) {
      query.client = client;
    }
    
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    
    if (service) {
      query['services.service'] = service;
    }
    
    const visits = await Visit.find(query)
      .populate('client', 'firstName lastName phone')
      .populate('services.service', 'name category')
      .populate('receptionist', 'firstName lastName')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Visit.countDocuments(query);
    
    res.json({
      visits,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      totalVisits: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching visits', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { 
      clientId, 
      services, 
      date, 
      paymentMethod,
      paymentStatus,
      notes,
      sendSMS
    } = req.body;
  
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    let totalAmount = 0;
    let totalLoyaltyPoints = 0;
    
    const processedServices = [];
    
    for (const serviceItem of services) {
      const serviceData = await Service.findById(serviceItem.serviceId);
      if (!serviceData) {
        return res.status(404).json({ message: `Service not found: ${serviceItem.serviceId}` });
      }
      
      if (!serviceData.isActive) {
        return res.status(400).json({ message: `Service is not active: ${serviceData.name}` });
      }
      
      const price = serviceItem.price || serviceData.price;
      totalAmount += price;
      totalLoyaltyPoints += serviceData.loyaltyPointsEarned;
      
      processedServices.push({
        service: serviceData._id,
        price,
        staff: serviceItem.staffId,
        notes: serviceItem.notes
      });
    }
    
    const visit = new Visit({
      client: clientId,
      services: processedServices,
      date: date || new Date(),
      totalAmount,
      paymentMethod,
      paymentStatus: paymentStatus || 'completed',
      loyaltyPointsEarned: totalLoyaltyPoints,
      receptionist: req.user.userId,
      notes
    });
    
    await visit.save();
    
    client.visitCount += 1;
    client.totalSpent += totalAmount;
    client.loyaltyPoints += totalLoyaltyPoints;
    client.updateMembershipLevel();
    await client.save();
  
    if (sendSMS && client.marketingConsent) {
      try {
        await sendThankYouSMS(client.phone, client.firstName, totalAmount);
        
        visit.smsSent = true;
        visit.smsSentAt = new Date();
        await visit.save();
      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
      }
    }
    
    const populatedVisit = await Visit.findById(visit._id)
      .populate('client', 'firstName lastName phone')
      .populate('services.service', 'name category')
      .populate('receptionist', 'firstName lastName');
    
    res.status(201).json({
      message: 'Visit recorded successfully',
      visit: populatedVisit
    });
  } catch (error) {
    res.status(500).json({ message: 'Error recording visit', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate('client', 'firstName lastName phone email')
      .populate('services.service', 'name category duration price')
      .populate('services.staff', 'firstName lastName')
      .populate('receptionist', 'firstName lastName');
    
    if (!visit) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    
    res.json(visit);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching visit', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { 
      services, 
      date, 
      paymentMethod,
      paymentStatus,
      notes
    } = req.body;
    
    const originalVisit = await Visit.findById(req.params.id);
    if (!originalVisit) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    
    const client = await Client.findById(originalVisit.client);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    let totalAmount = 0;
    let totalLoyaltyPoints = 0;
    
    const processedServices = [];
    
    if (services && services.length > 0) {
      for (const serviceItem of services) {
        const serviceData = await Service.findById(serviceItem.serviceId);
        if (!serviceData) {
          return res.status(404).json({ message: `Service not found: ${serviceItem.serviceId}` });
        }
        
        const price = serviceItem.price || serviceData.price;
        totalAmount += price;
        totalLoyaltyPoints += serviceData.loyaltyPointsEarned;
        
        processedServices.push({
          service: serviceData._id,
          price,
          staff: serviceItem.staffId,
          notes: serviceItem.notes
        });
      }
    } else {
      processedServices = originalVisit.services;
      totalAmount = originalVisit.totalAmount;
      totalLoyaltyPoints = originalVisit.loyaltyPointsEarned;
    }
    
    const updatedVisit = await Visit.findByIdAndUpdate(
      req.params.id,
      {
        services: processedServices,
        date: date || originalVisit.date,
        totalAmount,
        paymentMethod: paymentMethod || originalVisit.paymentMethod,
        paymentStatus: paymentStatus || originalVisit.paymentStatus,
        loyaltyPointsEarned: totalLoyaltyPoints,
        notes: notes || originalVisit.notes
      },
      { new: true }
    )
    .populate('client', 'firstName lastName phone')
    .populate('services.service', 'name category')
    .populate('receptionist', 'firstName lastName');
    
    const loyaltyDifference = totalLoyaltyPoints - originalVisit.loyaltyPointsEarned;
    if (loyaltyDifference !== 0) {
      client.loyaltyPoints += loyaltyDifference;
      client.updateMembershipLevel();
      await client.save();
    }
    
    res.json({
      message: 'Visit updated successfully',
      visit: updatedVisit
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating visit', error: error.message });
  }
});

router.patch('/:id/cancel', async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    
    if (!visit) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    
    if (visit.paymentStatus === 'cancelled') {
      return res.status(400).json({ message: 'Visit is already cancelled' });
    }
    
    const client = await Client.findById(visit.client);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    const originalStatus = visit.paymentStatus;
    
    visit.paymentStatus = 'cancelled';
    await visit.save();
    
    if (originalStatus === 'completed') {
      client.loyaltyPoints -= visit.loyaltyPointsEarned;
      if (client.loyaltyPoints < 0) client.loyaltyPoints = 0;
      
      client.updateMembershipLevel();
      await client.save();
    }
    
    res.json({
      message: 'Visit cancelled successfully',
      visit
    });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling visit', error: error.message });
  }
});

router.post('/:id/resend-sms', async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate('client', 'firstName lastName phone marketingConsent');
    
    if (!visit) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    
    if (!visit.client.marketingConsent) {
      return res.status(400).json({ message: 'Client has not consented to receive marketing messages' });
    }
    
    await sendThankYouSMS(
      visit.client.phone, 
      visit.client.firstName, 
      visit.totalAmount
    );
    
    visit.smsSent = true;
    visit.smsSentAt = new Date();
    await visit.save();
    
    res.json({
      message: 'Thank you SMS sent successfully',
      visit
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending SMS', error: error.message });
  }
});

router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    
    if (!visit) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    
    const client = await Client.findById(visit.client);
    if (client) {
      client.visitCount = Math.max(0, client.visitCount - 1);
      client.totalSpent = Math.max(0, client.totalSpent - visit.totalAmount);
      client.loyaltyPoints = Math.max(0, client.loyaltyPoints - visit.loyaltyPointsEarned);
      
      client.updateMembershipLevel();
      await client.save();
    }
    
    await Visit.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Visit deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting visit', error: error.message });
  }
});

module.exports = router;
