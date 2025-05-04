const express = require('express');
const Client = require('../models/Client');
const Visit = require('../models/Visit');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'lastName', 
      sortOrder = 'asc',
      search,
      membershipLevel
    } = req.query;
    
    let query = {};
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query = {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { phone: searchRegex },
          { email: searchRegex }
        ]
      };
    }
    
    if (membershipLevel) {
      query.membershipLevel = membershipLevel;
    }
    
    const clients = await Client.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Client.countDocuments(query);
    
    res.json({
      clients,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalClients: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clients', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      phone, 
      email, 
      gender, 
      birthdate,
      address,
      notes,
      marketingConsent
    } = req.body;
    
    const existingClient = await Client.findOne({ phone });
    if (existingClient) {
      return res.status(400).json({ 
        message: 'Client with this phone number already exists',
        client: existingClient
      });
    }
    
    const client = new Client({
      firstName,
      lastName,
      phone,
      email,
      gender,
      birthdate,
      address,
      notes,
      marketingConsent: marketingConsent || false
    });
    
    await client.save();
    
    res.status(201).json({
      message: 'Client created successfully',
      client
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating client', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    const visits = await Visit.find({ client: req.params.id })
      .populate('services.service')
      .sort({ date: -1 });
    
    res.json({
      client,
      visits
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      gender,
      birthdate,
      address,
      notes,
      marketingConsent
    } = req.body;
    
    const updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      {
        firstName,
        lastName,
        phone,
        email,
        gender,
        birthdate,
        address,
        notes,
        marketingConsent
      },
      { new: true }
    );
    
    if (!updatedClient) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    res.json({
      message: 'Client updated successfully',
      client: updatedClient
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating client', error: error.message });
  }
});

router.get('/search/:query', async (req, res) => {
  try {
    const searchQuery = req.params.query;
    const searchRegex = new RegExp(searchQuery, 'i');
    
    const clients = await Client.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { phone: searchRegex }
      ]
    }).limit(10);
    
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Error searching clients', error: error.message });
  }
});

router.get('/loyalty/list', isAdmin, async (req, res) => {
  try {
    const { minPoints = 0 } = req.query;
    
    const clients = await Client.find({ 
      loyaltyPoints: { $gte: parseInt(minPoints) }
    }).sort({ loyaltyPoints: -1 });
    
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching loyalty clients', error: error.message });
  }
});

router.patch('/:id/loyalty', isAdmin, async (req, res) => {
  try {
    const { points, adjustment } = req.body;
    
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    if (adjustment) {
      client.loyaltyPoints += parseInt(points);
    } else {
      client.loyaltyPoints = parseInt(points);
    }
    
    if (client.loyaltyPoints < 0) {
      client.loyaltyPoints = 0;
    }
    
    client.updateMembershipLevel();
    await client.save();
    
    res.json({
      message: 'Loyalty points updated successfully',
      client
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating loyalty points', error: error.message });
  }
});

router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    const visitCount = await Visit.countDocuments({ client: req.params.id });
    if (visitCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete client with visit history. Consider archiving instead.' 
      });
    }
    
    await Client.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting client', error: error.message });
  }
});

module.exports = router;