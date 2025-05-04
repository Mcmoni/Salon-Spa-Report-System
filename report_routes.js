const express = require('express');
const mongoose = require('mongoose');
const Visit = require('../models/Visit');
const Client = require('../models/Client');
const Service = require('../models/Service');
const User = require('../models/User');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/revenue', async (req, res) => {
  try {
    const { 
      startDate = new Date(new Date().setDate(new Date().getDate() - 30)), 
      endDate = new Date(),
      groupBy = 'day'
    } = req.query;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); 
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    let groupFormat;
    switch(groupBy) {
      case 'day':
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
        break;
      case 'week':
        groupFormat = { 
          $dateToString: { 
            format: '%Y-W%V', 
            date: '$date' 
          } 
        };
        break;
      case 'month':
        groupFormat = { $dateToString: { format: '%Y-%m', date: '$date' } };
        break;
      case 'year':
        groupFormat = { $dateToString: { format: '%Y', date: '$date' } };
        break;
      default:
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
    }
    
    const revenueData = await Visit.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: groupFormat,
          totalRevenue: { $sum: '$totalAmount' },
          visitCount: { $sum: 1 },
          averageTicket: { $avg: '$totalAmount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
  
    const paymentMethodData = await Visit.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const summary = await Visit.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalVisits: { $sum: 1 },
          averageTicket: { $avg: '$totalAmount' }
        }
      }
    ]);
    
    res.json({
      timeSeries: revenueData,
      paymentMethods: paymentMethodData,
      summary: summary.length > 0 ? summary[0] : { totalRevenue: 0, totalVisits: 0, averageTicket: 0 }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating revenue report', error: error.message });
  }
});

router.get('/services', async (req, res) => {
  try {
    const { 
      startDate = new Date(new Date().setDate(new Date().getDate() - 30)),
      endDate = new Date(),
      limit = 10
    } = req.query;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    const popularServices = await Visit.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      { $unwind: '$services' },
      {
        $group: {
          _id: '$services.service',
          count: { $sum: 1 },
          revenue: { $sum: '$services.price' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'serviceDetails'
        }
      },
      {
        $unwind: '$serviceDetails'
      },
      {
        $project: {
          _id: 1,
          name: '$serviceDetails.name',
          category: '$serviceDetails.category',
          count: 1,
          revenue: 1
        }
      }
    ]);
    
    const servicesByCategory = await Visit.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      { $unwind: '$services' },
      {
        $lookup: {
          from: 'services',
          localField: 'services.service',
          foreignField: '_id',
          as: 'serviceDetails'
        }
      },
      { $unwind: '$serviceDetails' },
      {
        $group: {
          _id: '$serviceDetails.category',
          count: { $sum: 1 },
          revenue: { $sum: '$services.price' }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);
    
    res.json({
      topServices: popularServices,
      servicesByCategory
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating services report', error: error.message });
  }
});

router.get('/clients', isAdmin, async (req, res) => {
  try {
    const { 
      startDate = new Date(new Date().setDate(new Date().getDate() - 90)),
      endDate = new Date()
    } = req.query;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    const newClients = await Client.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    const clientVisitTypes = await Visit.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: 'client',
          foreignField: '_id',
          as: 'clientDetails'
        }
      },
      { $unwind: '$clientDetails' },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$date' } },
            isNew: { $eq: ['$clientDetails.visitCount', 1] }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { '_id.month': 1, '_id.isNew': -1 }
      }
    ]);
    
    const topClients = await Visit.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: '$client',
          totalSpent: { $sum: '$totalAmount' },
          visitCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalSpent: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'clientDetails'
        }
      },
      { $unwind: '$clientDetails' },
      {
        $project: {
          _id: 1,
          firstName: '$clientDetails.firstName',
          lastName: '$clientDetails.lastName',
          phone: '$clientDetails.phone',
          email: '$clientDetails.email',
          totalSpent: 1,
          visitCount: 1,
          membershipLevel: '$clientDetails.membershipLevel',
          loyaltyPoints: '$clientDetails.loyaltyPoints'
        }
      }
    ]);
    
    const totalClients = await Client.countDocuments({ createdAt: { $lt: end } });
    const activeClients = await Visit.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: '$client'
        }
      },
      {
        $count: 'count'
      }
    ]);
    
    const retentionRate = totalClients > 0 && activeClients.length > 0 
      ? (activeClients[0].count / totalClients) * 100 
      : 0;
    
    res.json({
      newClientSignups: newClients,
      clientVisitTypes,
      topClients,
      retentionRate: parseFloat(retentionRate.toFixed(2)),
      totalClients,
      activeClients: activeClients.length > 0 ? activeClients[0].count : 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating client report', error: error.message });
  }
});

// Get staff performance report (admin only)
router.get('/staff', isAdmin, async (req, res) => {
  try {
    const { 
      startDate = new Date(new Date().setDate(new Date().getDate() - 30)),
      endDate = new Date()
    } = req.query;
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    // Get service counts by staff
    const staffServiceCounts = await Visit.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      { $unwind: '$services' },
      { 
        $match: { 
          'services.staff': { $exists: true, $ne: null } 
        }
      },
      {
        $group: {
          _id: '$services.staff',
          serviceCount: { $sum: 1 },
          revenue: { $sum: '$services.price' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'staffDetails'
        }
      },
      { $unwind: '$staffDetails' },
      {
        $project: {
          _id: 1,
          firstName: '$staffDetails.firstName',
          lastName: '$staffDetails.lastName',
          position: '$staffDetails.position',
          serviceCount: 1,
          revenue: 1
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);
    
    // Get receptionist performance
    const receptionistPerformance = await Visit.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: '$receptionist',
          visitCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          averageTicket: { $avg: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          _id: 1,
          firstName: '$userDetails.firstName',
          lastName: '$userDetails.lastName',
          role: '$userDetails.role',
          visitCount: 1,
          revenue: 1,
          averageTicket: 1
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);
    
    res.json({
      staffPerformance: staffServiceCounts,
      receptionistPerformance
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating staff report', error: error.message });
  }
});

router.get('/daily', async (req, res) => {
  try {
    const { date = new Date() } = req.query;
   
    const reportDate = new Date(date);
    if (isNaN(reportDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const visits = await Visit.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    })
    .populate('client', 'firstName lastName phone')
    .populate('services.service', 'name category')
    .populate('services.staff', 'firstName lastName')
    .populate('receptionist', 'firstName lastName')
    .sort({ date: 1 });
    
    const summary = {
      totalVisits: visits.length,
      totalRevenue: visits.reduce((sum, visit) => 
        visit.paymentStatus === 'completed' ? sum + visit.totalAmount : sum, 0),
      paymentMethods: {},
      serviceCount: 0
    };
    
    visits.forEach(visit => {
      if (visit.paymentStatus === 'completed') {
        summary.paymentMethods[visit.paymentMethod] = 
          (summary.paymentMethods[visit.paymentMethod] || 0) + 1;
      }
      summary.serviceCount += visit.services.length;
    });
    
    const newClients = await Client.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).count();
    
    summary.newClients = newClients;
    
    res.json({
      date: reportDate,
      visits,
      summary
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating daily report', error: error.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    
    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    
    const todayRevenue = await Visit.aggregate([
      {
        $match: {
          date: { $gte: startOfToday, $lte: endOfToday },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const monthRevenue = await Visit.aggregate([
      {
        $match: {
          date: { $gte: startOfMonth, $lte: endOfMonth },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const prevMonthRevenue = await Visit.aggregate([
      {
        $match: {
          date: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const currentMonthTotal = monthRevenue.length > 0 ? monthRevenue[0].total : 0;
    const prevMonthTotal = prevMonthRevenue.length > 0 ? prevMonthRevenue[0].total : 0;
    
    const growthPercentage = prevMonthTotal > 0 
      ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 
      : 0;
    
    const totalClients = await Client.countDocuments();
    const newClientsThisMonth = await Client.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const upcomingVisits = await Visit.find({
      date: { $gt: today },
      paymentStatus: { $nin: ['cancelled'] }
    })
    .populate('client', 'firstName lastName phone')
    .sort({ date: 1 })
    .limit(5);
    
    res.json({
      todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
      todayVisits: todayRevenue.length > 0 ? todayRevenue[0].count : 0,
      monthRevenue: currentMonthTotal,
      monthVisits: monthRevenue.length > 0 ? monthRevenue[0].count : 0,
      revenueGrowth: parseFloat(growthPercentage.toFixed(2)),
      totalClients,
      newClientsThisMonth,
      upcomingVisits
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating dashboard data', error: error.message });
  }
});


router.get('/export/:type', isAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate } = req.query;
    
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
    }
    
    let data;
    
    switch(type) {
      case 'visits':
        data = await Visit.find(
          start && end ? { date: { $gte: start, $lte: end } } : {}
        )
        .populate('client', 'firstName lastName phone email')
        .populate('services.service', 'name category price')
        .populate('services.staff', 'firstName lastName')
        .populate('receptionist', 'firstName lastName')
        .sort({ date: -1 });
        break;
        
      case 'clients':
        data = await Client.find()
        .sort({ lastName: 1, firstName: 1 });
        break;
        
      case 'services':
        data = await Service.find()
        .sort({ category: 1, name: 1 });
        break;
        
      case 'staff':
        data = await User.find()
        .select('-password')
        .sort({ role: 1, lastName: 1 });
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid export type' });
    }
    
    res.json({
      type,
      exportedAt: new Date(),
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ message: 'Error exporting data', error: error.message });
  }
});

module.exports = router;