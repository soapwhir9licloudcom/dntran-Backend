// FleetFlow Dialer backend (Render)
const express = require('express');
const cors = require('cors');
const { AccessToken } = require('twilio').jwt;
const { VoiceResponse } = require('twilio').twiml;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();

// ✅ Allow requests only from your FleetFlow dialer domain
app.use(cors({
  origin: ['https://dialer.dntransportllc.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.urlencoded({ extended: false })); // Twilio posts form-encoded
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---- Env vars ----
const accountSid   = process.env.TWILIO_ACCOUNT_SID; // ACxxxxxxxxxxxxxxxxxxxx
const apiKeySid    = process.env.TWILIO_API_KEY;     // SKxxxxxxxxxxxxxxxxxxxx
const apiKeySecret = process.env.TWILIO_API_SECRET;  // Your API Key Secret
const twimlAppSid  = process.env.TWIML_APP_SID;      // APxxxxxxxxxxxxxxxxxxxx
const CALLER_ID    = process.env.CALLER_ID || '+15132245530'; // Your Twilio Number

// ---- Health Page ----
app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html><meta charset="utf-8">
    <style>body{font-family:system-ui;padding:24px}</style>
    <h2>FleetFlow Dialer API</h2>
    <ul>
      <li><a href="/token">GET /token</a> — returns a Voice Access Token</li>
      <li>POST /voice — TwiML webhook for outbound calls</li>
    </ul>
  `);
});

// ---- /token ----
app.get('/token', (_req, res) => {
  try {
    const identity = 'FleetFlowUser_9351'; // must match your dialer <Client> name

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    });

    token.addGrant(new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    }));

    res.json({ identity, token: token.toJwt() });
  } catch (err) {
    console.error('Token error:', err);
    res.status(500).json({ error: 'Token generation failed', details: err.message });
  }
});

// ---- /voice ----
app.post('/voice', (req, res) => {
  const vr = new VoiceResponse();
  const dial = vr.dial({ callerId: CALLER_ID, answerOnBridge: true, timeout: 30 });

  const to = req.body?.To ? String(req.body.To).trim() : '';
  console.log('Received call to:', to);

  if (to) {
    if (/^[\d+\-() ]+$/.test(to)) {
      dial.number(to); // real phone number
    } else {
      dial.client(to); // Twilio Client identity
    }
  } else {
    vr.say('Thanks for calling FleetFlow. Please hold while we connect you.');
    dial.client('FleetFlowUser_9351');
  }

  res.type('text/xml').send(vr.toString());
});

// ---- Start Server ----
app.listen(PORT, () => {
  console.log(`✅ FleetFlow Token & Voice server running on port ${PORT}`);
});
