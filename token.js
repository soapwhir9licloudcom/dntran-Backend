// ============================================================
// File: token.js
// Service: dntran-backend (Render)
// Purpose: Provides Twilio Access Token and TwiML for FleetFlow Dialer
// ============================================================

const express = require('express');
const cors = require('cors');
const { AccessToken } = require('twilio').jwt;
const { VoiceResponse } = require('twilio').twiml;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();

// ====== CORS (Fixed version) ======
// This allows any HTTPS origin for now — fixes “not allowed by Access-Control-Allow-Origin” errors.
// Once you confirm it works, restrict origin to your own domain.
app.use(cors({
  origin: true,                  // Reflects the request origin automatically
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.options('*', cors());         // Handles preflight checks from browsers

app.use(express.urlencoded({ extended: false })); // For Twilio form POSTs
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ====== Environment Variables (set in Render Dashboard) ======
const accountSid   = process.env.TWILIO_ACCOUNT_SID;   // ACxxxxxxxxxxxx
const apiKeySid    = process.env.TWILIO_API_KEY;       // SKxxxxxxxxxxxx
const apiKeySecret = process.env.TWILIO_API_SECRET;    // your Twilio API secret
const twimlAppSid  = process.env.TWIML_APP_SID;        // APxxxxxxxxxxxx (TwiML App SID)
const CALLER_ID    = process.env.CALLER_ID || '+15132245530'; // your Twilio number
// =============================================================


// ====== Health Check Endpoint ======
app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html><meta charset="utf-8">
    <style>body{font-family:system-ui;padding:24px}</style>
    <h2>✅ FleetFlow Dialer API is running (dntran-backend)</h2>
    <ul>
      <li><a href="/token">GET /token</a> — Returns Access Token (VoiceGrant)</li>
      <li>POST /voice — TwiML webhook for outbound calls</li>
    </ul>
  `);
});


// ====== /token endpoint ======
app.get('/token', (req, res) => {
  try {
    const identity = 'FleetFlowUser_9351'; // must match your client identity

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid, // APxxxxxxxxxxxx (TwiML App SID)
      incomingAllow: true,
    });

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    });

    token.addGrant(voiceGrant);

    res.json({
      identity,
      token: token.toJwt(),
    });
  } catch (err) {
    console.error('❌ Token generation failed:', err);
    res.status(500).json({
      error: 'Token generation failed',
      details: err.message,
    });
  }
});


// ====== /voice endpoint ======
app.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const dial = twiml.dial({ callerId: CALLER_ID });
  const to = req.body.To;
  console.log('Received call to:', to);

  if (to) {
    if (/^[\\d+\\-() ]+$/.test(to)) {
      dial.number(to); // Dial real phone number
    } else {
      dial.client(to); // Dial client identity
    }
  } else {
    twiml.say("Thanks for calling FleetFlow. Please hold while we connect you.");
    dial.client('FleetFlowUser_9351'); // Fallback
  }

  res.type('text/xml');
  res.send(twiml.toString());
});


// ====== Start Server ======
app.listen(PORT, () => {
  console.log(`✅ FleetFlow Token & Voice server running on port ${PORT}`);
});
