const express = require('express');
const Service = require('../models/Service');
const Visit = require('../models/Visit');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { 
      category,
      isActive,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;
    
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const services = await Service.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
    
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching services', error: error.message });
  }
});

router.post('/', isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      duration,
      price,
      loyaltyPointsEarned
    } = req.body;
    
    const existingService = await Service.findOne({ name });
    if (existingService) {
      return res.status(400).json({ message: 'Service with this name already exists' });
    }
    
    const service = new Service({
      name,
      description,
      category,
      duration,
      price,
      loyaltyPointsEarned: loyaltyPointsEarned || Math.floor(price / 10) 
    });
    
    await service.save();
    
    res.status(201).json({
      message: 'Service created successfully',
      service
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating service', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching service', error: error.message });
  }
});

router.put('/:id', isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      duration,
      price,
      loyaltyPointsEarned,
      isActive
    } = req.body;
    
    if (name) {
      const existingService = await Service.findOne({ 
        name, 
        _id: { $ne: req.params.id } 
      });
      
      if (existingService) {
        return res.status(400).json({ message: 'Another service with this name already exists' });
      }
    }
    
    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        category,
        duration,
        price,
        loyaltyPointsEarned,
        isActive
      },
      { new: true }
    );
    
    if (!updatedService) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    res.json({
      message: 'Service updated successfully',
      service: updatedService
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating service', error: error.message });
  }
});

router.get('/:id/stats', isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const serviceId = req.params.id;
    
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else if (startDate) {
      dateQuery = { date: { $gte: new Date(startDate) } };
    } else if (endDate) {
      dateQuery = { date: { $lte: new Date(endDate) } };
    }
    
    const visits = await Visit.find({
      'services.service': serviceId,
      paymentStatus: 'completed',
      ...dateQuery
    });
    
    const totalUsage = visits.length;
    let totalRevenue = 0;
    
    visits.forEach(visit => {
      const serviceInstance = visit.services.find(s => 
        s.service.toString() === serviceId
      );
      
      if (serviceInstance) {
        totalRevenue += serviceInstance.price;
      }
    });
    
    const dailyUsage = {};
    visits.forEach(visit => {
      const dateStr = visit.date.toISOString().split('T')[0];
      dailyUsage[dateStr] = (dailyUsage[dateStr] || 0) + 1;
    });
    
    res.json({
      service: {
        id: service._id,
        name: service.name,
        category: service.category,
        price: service.price
      },
      stats: {
        totalUsage,
        totalRevenue,
        averageRevenue: totalUsage ? totalRevenue / totalUsage : 0,
        dailyUsage
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching service statistics', error: error.message });
  }
});

router.patch('/:id/status', isAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    res.json({
      message: `Service ${isActive ? 'activated' : 'deactivated'} successfully`,
      service
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating service status', error: error.message });
  }
});

router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Service.distinct('category');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

module.exports = router;
