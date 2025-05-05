const axios = require('axios');
const logger = require('../../utils/logger');

class HubtelSMSService {
  constructor() {
    this.baseURL = process.env.HUBTEL_API_URL || 'https://api.hubtel.com/v1/messages';
    this.clientId = process.env.HUBTEL_CLIENT_ID;
    this.clientSecret = process.env.HUBTEL_CLIENT_SECRET;
    this.senderId = process.env.HUBTEL_SENDER_ID || 'SALON&SPA';
  }

  /**
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - Message content
   * @returns {Promise} - Result of the SMS sending operation
   */
  async sendSMS(phoneNumber, message) {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios({
        method: 'post',
        url: this.baseURL,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        data: {
          from: this.senderId,
          to: formattedPhone,
          content: message
        }
      });
      
      logger.info(`SMS sent to ${formattedPhone} successfully`, { response: response.data });
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Error sending SMS via Hubtel', { 
        error: error.message, 
        phoneNumber, 
        responseData: error.response?.data 
      });
      
      return { 
        success: false, 
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length === 9) {
      return `+233${cleaned}`;
    } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
      return `+233${cleaned.substring(1)}`;
    } else if (cleaned.length > 10 && !cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    
    return phoneNumber;
  }

  /**
   * @param {string} clientName - Client's first name
   * @param {string} serviceName - Service received
   * @param {number} amount - Amount paid
   * @returns {string} - Formatted thank you message
   */
  generateThankYouMessage(clientName, serviceName, amount) {
    return `Dear ${clientName}, thank you for visiting our salon & spa today. We appreciate your business and hope you enjoyed your ${serviceName}. Total: GHS ${amount}. We look forward to seeing you again soon!`;
  }

  /**
   * @param {string} clientName - Client's first name
   * @param {string} promoDetails - Promotion details
   * @returns {string} - Formatted promotional message
   */
  generatePromoMessage(clientName, promoDetails) {
    return `Hello ${clientName}! ${promoDetails} Visit us again soon at our salon & spa. To opt out, reply STOP.`;
  }
}

module.exports = new HubtelSMSService();
