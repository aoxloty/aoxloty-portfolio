// Netlify Serverless Function
// File: netlify/functions/send-message.js

const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  let IS_OPEN = false;
  try {
    const settingsPath = path.join(process.cwd(), 'notification.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    IS_OPEN = settings.send_enabled === true;
  } catch (e) {
    console.error('Could not read notification.json:', e);
    IS_OPEN = false;
  }

  if (!IS_OPEN) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ success: false, error: 'Message box is closed' })
    };
  }

  try {
    const { message } = JSON.parse(event.body);


    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    if (message.length > 500) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message too long (max 500 characters)' })
      };
    }

    // Lấy webhook URL từ environment variable (BẢO MẬT)
    const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    if (!WEBHOOK_URL) {
      console.error('DISCORD_WEBHOOK_URL not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }


    const discordResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [{
          title: '📩 Message',
          description: message.trim(),
          color: 0xFFA500,
          footer: {
            text: `Sent at ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
          },
          timestamp: new Date().toISOString()
        }]
      })
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error('Discord API error:', discordResponse.status, errorText);

      if (discordResponse.status === 429) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({ error: 'Too many requests, please try again later' })
        };
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to send message' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};