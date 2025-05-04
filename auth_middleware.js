const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
};

const recordLoginTime = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, { lastLogin: Date.now() });
  } catch (error) {
    console.error('Error updating last login time:', error);
  }
};

module.exports = {
  authenticateJWT,
  isAdmin,
  recordLoginTime
};
