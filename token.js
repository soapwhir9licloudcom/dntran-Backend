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

// ====== CORS ======
// Allow your Bluehost domain so the dialer can reach this API.
app.use(cors({
  origin: [
    'https://dialer.yourdomain.com',     // replace with your actual dialer domain
    'https://www.yourdomain.com'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.urlencoded({ extended: false })); // for Twilio webhook form POSTs
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ====== Environment Variables (set these in Render Dashboard) ======
const accountSid   = process.env.TWILIO_ACCOUNT_SID;   // ACxxxxxxxxxxxx
const apiKeySid    = process.env.TWILIO_API_KEY;       // SKxxxxxxxxxxxx
const apiKeySecret = process.env.TWILIO_API_SECRET;    // your Twilio API secret
const twimlAppSid  = process.env.TWIML_APP_SID;        // APxxxxxxxxxxxx (TwiML App SID)
const CALLER_ID    = process.env.CALLER_ID || '+15132245530'; // your Twilio phone number
// ================================================================


// ====== Health Check Endpoint ======
app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html><meta charset="utf-8">
    <style>body{font-family:system-ui;padding:24px}</style>
    <h2>✅ FleetFlow Dialer API is running</h2>
    <ul>
      <li>GET <a href="/token">/token</a> — returns Twilio Access Token with VoiceGrant</li>
      <li>POST /voice — handles outbound call requests from browser</li>
    </ul>
  `);
});


// ====== /token endpoint ======
// This is the critical part that gives your browser permission to call.
app.get('/token', (req, res) => {
  try {
    const identity = 'FleetFlowUser_9351'; // must match your dialer’s client identity

    // Create a VoiceGrant for outgoing + incoming permissions
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid, // link to your TwiML App (APxxxxxxxxxx)
      incomingAllow: true,
    });

    // Create the access token itself
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600, // valid for 1 hour
    });

    // Attach the VoiceGrant
    token.addGrant(voiceGrant);

    // Send the token as JSON
    res.json({
      identity,
      token: token.toJwt(),
    });

  } catch (err) {
    console.error('❌ Token generation error:', err);
    res.status(500).json({ error: 'Token generation failed', details: err.message });
  }
});


// ====== /voice endpoint ======
// This generates TwiML instructions for outgoing or client-to-client calls.
app.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const dial = twiml.dial({ callerId: CALLER_ID });
  const to = req.body.To;
  console.log('Received outbound call request to:', to);

  if (to) {
    if (/^[\d+\-() ]+$/.test(to)) {
      dial.number(to); // Call a real phone number
    } else {
      dial.client(to); // Or connect to a client identity
    }
  } else {
    twiml.say("Thanks for calling FleetFlow. Please hold while we connect you.");
    dial.client('FleetFlowUser_9351');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});


// ====== Start Server ======
app.listen(PORT, () => {
  console.log(`✅ FleetFlow Token & Voice server running on port ${PORT}`);
});
