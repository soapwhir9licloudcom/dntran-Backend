// ============================================================
// File: token.js  (Render service: dntran-backend)
// Purpose: Twilio Access Token + TwiML + strict CORS
// ============================================================

const express = require('express');
const { AccessToken } = require('twilio').jwt;
const { VoiceResponse } = require('twilio').twiml;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();
app.use(express.urlencoded({ extended: false })); // for Twilio form posts
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ====== CORS (allow only your dialer domains) ======
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = new Set([
    'https://dialer.dntransportllc.com',
    'https://www.dntransportllc.com',
    'https://dntransportllc.com',
    // if you test over http (not recommended), temporarily add:
    // 'http://dialer.dntransportllc.com',
    // 'http://www.dntransportllc.com',
    // 'http://dntransportllc.com',
  ]);

  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ====== REQUIRED ENV VARS (Render → Environment) ======
// TWILIO_ACCOUNT_SID = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// TWILIO_API_KEY     = SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
// TWILIO_API_SECRET  = your_api_key_secret
// TWIML_APP_SID      = APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   (your TwiML App SID)
// CALLER_ID          = +1XXXXXXXXXX                        (your Twilio number)
const accountSid   = process.env.TWILIO_ACCOUNT_SID;
const apiKeySid    = process.env.TWILIO_API_KEY;
const apiKeySecret = process.env.TWILIO_API_SECRET;
const twimlAppSid  = process.env.TWIML_APP_SID;
const CALLER_ID    = process.env.CALLER_ID || '+15132245530';

// ====== Health page ======
app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html><meta charset="utf-8">
    <style>body{font-family:system-ui;padding:24px}</style>
    <h2>✅ FleetFlow Dialer API (dntran-backend)</h2>
    <ul>
      <li><a href="/token">GET /token</a> — Access Token (VoiceGrant)</li>
      <li>POST /voice — TwiML webhook for outbound calls</li>
    </ul>
  `);
});

// ====== /token — returns Access Token WITH incomingAllow ======
app.get('/token', (_req, res) => {
  try {
    const identity = 'FleetFlowUser_9351'; // must match your browser Client identity

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid, // enables outbound via your TwiML App
      incomingAllow: true,                 // <-- enables ringing in the browser
    });

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600, // 1 hour
    });

    token.addGrant(voiceGrant);

    res.json({ identity, token: token.toJwt() });
  } catch (err) {
    console.error('❌ Token generation failed:', err);
    res.status(500).json({ error: 'Token generation failed', details: err.message });
  }
});

// ====== /voice — TwiML used when the browser calls Device.connect({To}) ======
app.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const dial = twiml.dial({ callerId: CALLER_ID, answerOnBridge: true, timeout: 30 });

  const to = req.body && req.body.To ? String(req.body.To).trim() : '';
  console.log('Received outbound request To:', to);

  if (to) {
    if (/^[\d+\-() ]+$/.test(to)) {
      dial.number(to);     // call real phone number
    } else {
      dial.client(to);     // or Twilio Client identity
    }
  } else {
    twiml.say('Thanks for calling FleetFlow. Please hold while we connect you.');
    dial.client('FleetFlowUser_9351'); // fallback
  }

  res.type('text/xml').send(twiml.toString());
});

// ====== Start server ======
app.listen(PORT, () => {
  console.log(`✅ FleetFlow Token & Voice server running on port ${PORT}`);
});
