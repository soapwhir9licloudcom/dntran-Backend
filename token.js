// ============================================================
// File: token.js  (Render service: dntran-backend)
// Purpose: Twilio Access Token + TwiML with CORS FIXED
// ============================================================

const express = require('express');
const { AccessToken } = require('twilio').jwt;
const { VoiceResponse } = require('twilio').twiml;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ====== HARD-CODED CORS FIX (no guessing) ======
app.use((req, res, next) => {
  // Allow the dialer subdomain and your root domain; add more if needed
  const origin = req.headers.origin;
  const allowed = new Set([
    'https://dialer.dntransportllc.com',
    'https://www.dntransportllc.com',
    'https://dntransportllc.com',
    'http://dialer.dntransportllc.com',   // include http during testing if needed
    'http://www.dntransportllc.com',
    'http://dntransportllc.com'
  ]);

  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // While debugging, you can uncomment the next line to allow any origin:
    // res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // no cookies/credentials used by frontend
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ====== ENV VARS (set these in Render) ======
const accountSid   = process.env.TWILIO_ACCOUNT_SID;   // AC...
const apiKeySid    = process.env.TWILIO_API_KEY;       // SK...
const apiKeySecret = process.env.TWILIO_API_SECRET;    // secret
const twimlAppSid  = process.env.TWIML_APP_SID;        // AP...
const CALLER_ID    = process.env.CALLER_ID || '+15132245530';

// ====== Health ======
app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html><meta charset="utf-8">
    <style>body{font-family:system-ui;padding:24px}</style>
    <h2>✅ FleetFlow Dialer API (dntran-backend)</h2>
    <ul>
      <li><a href="/token">GET /token</a> — Twilio Access Token (VoiceGrant)</li>
      <li>POST /voice — TwiML webhook for outbound calls</li>
    </ul>
  `);
});

// ====== /token — returns Access Token WITH VoiceGrant ======
app.get('/token', (_req, res) => {
  try {
    const identity = 'FleetFlowUser_9351';

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid, // AP...
      incomingAllow: true,
    });

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    });

    token.addGrant(voiceGrant);

    res.json({ identity, token: token.toJwt() });
  } catch (err) {
    console.error('❌ Token generation failed:', err);
    res.status(500).json({ error: 'Token generation failed', details: err.message });
  }
});

// ====== /voice — TwiML for Device.connect({ To }) ======
app.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const dial = twiml.dial({ callerId: CALLER_ID });
  const to = req.body && req.body.To ? String(req.body.To).trim() : '';
  console.log('Received call to:', to);

  if (to) {
    if (/^[\d+\-() ]+$/.test(to)) {
      dial.number(to);  // PSTN
    } else {
      dial.client(to);  // Client identity
    }
  } else {
    twiml.say('Thanks for calling FleetFlow. Please hold while we connect you.');
    dial.client('FleetFlowUser_9351');
  }

  res.type('text/xml').send(twiml.toString());
});

// ====== Start ======
app.listen(PORT, () => {
  console.log(`✅ FleetFlow Token & Voice server running on port ${PORT}`);
});
