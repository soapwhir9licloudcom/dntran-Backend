// ============================================================
// File: token.js  (Render service: dntran-backend)
// Purpose: Twilio Access Token + TwiML + CORS + SDK proxy (v1.18)
// ============================================================

const express = require('express');
const https = require('https');
const { AccessToken } = require('twilio').jwt;
const { VoiceResponse } = require('twilio').twiml;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ====== CORS (allow your dialer domain) ======
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = new Set([
    'https://dialer.dntransportllc.com',
    'https://www.dntransportllc.com',
    'https://dntransportllc.com',
    'http://dialer.dntransportllc.com',
    'http://www.dntransportllc.com',
    'http://dntransportllc.com'
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
      <li><a href="/twilio-sdk.js">GET /twilio-sdk.js</a> — Twilio Client SDK v1.18 (proxy)</li>
    </ul>
  `);
});

// ====== Twilio Client SDK proxy (follows redirects) ======
const URL_TO_FETCH = 'https://media.twiliocdn.com/sdk/js/client/v1.18/twilio.min.js';
function proxyGet(url, res, hop = 0) {
  if (hop > 5) return res.status(508).send('SDK fetch redirect loop');
  https.get(url, { headers: { 'User-Agent': 'dntran-backend/1.0' } }, r => {
    if ([301,302,307,308].includes(r.statusCode) && r.headers.location) {
      const next = r.headers.location.startsWith('http')
        ? r.headers.location
        : new URL(r.headers.location, url).toString();
      return proxyGet(next, res, hop + 1);
    }
    if (r.statusCode !== 200) {
      return res.status(r.statusCode || 502).send(`SDK fetch failed (HTTP ${r.statusCode})`);
    }
    res.setHeader('Content-Type', 'application/javascript');
    r.pipe(res);
  }).on('error', e => res.status(502).send('SDK fetch error: ' + e.message));
}
app.get('/twilio-sdk.js', (req, res) => proxyGet(URL_TO_FETCH, res));

// ====== /token — Access Token with VoiceGrant ======
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

  if (to) {
    if (/^[\d+\-() ]+$/.test(to)) {
      dial.number(to);  // real phone number
    } else {
      dial.client(to);  // Twilio Client identity
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
