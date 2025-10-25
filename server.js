// FleetFlow Dialer backend (Render)
const express = require('express');
const cors = require('cors');
const { AccessToken } = require('twilio').jwt;
const { VoiceResponse } = require('twilio').twiml;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();
app.use(cors()); // for production, restrict to your Bluehost domain
app.use(express.urlencoded({ extended: false })); // Twilio posts form-encoded
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---- Env vars ----
const accountSid   = process.env.TWILIO_ACCOUNT_SID; // AC...
const apiKeySid    = process.env.TWILIO_API_KEY;     // SK...
const apiKeySecret = process.env.TWILIO_API_SECRET;  // API Key Secret
const twimlAppSid  = process.env.TWIML_APP_SID;      // AP...
const CALLER_ID    = process.env.CALLER_ID || '+15132245530'; // your Twilio number

// ---- Health page so "/" works ----
app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html><meta charset="utf-8">
    <style>body{font-family:system-ui;padding:24px}</style>
    <h2>FleetFlow Dialer API</h2>
    <ul>
      <li>GET <a href="/token">/token</a> — returns a Voice Access Token</li>
      <li>POST /voice — TwiML webhook for outbound calls</li>
    </ul>
  `);
});

// ---- /token: Voice Access Token with VoiceGrant -> TwiML App ----
app.get('/token', (_req, res) => {
  try {
    const identity = 'FleetFlowUser_9351'; // your browser client identity

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    });

    token.addGrant(new VoiceGrant({
      outgoingApplicationSid: twimlAppSid, // AP...
      incomingAllow: true,
    }));

    res.json({ identity, token: token.toJwt() });
  } catch (err) {
    console.error('Token error:', err);
    res.status(500).json({ error: 'Token generation failed', details: err.message });
  }
});

// ---- /voice: TwiML called when the browser does Device.connect({To}) ----
app.post('/voice', (req, res) => {
  const vr = new VoiceResponse();
  const dial = vr.dial({ callerId: CALLER_ID, answerOnBridge: true, timeout: 30 });

  const to = (req.body && req.body.To) ? String(req.body.To).trim() : '';
  console.log('Received call to:', to);

  if (to) {
    if (/^[\d+\-() ]+$/.test(to)) {
      dial.number(to);      // PSTN number
    } else {
      dial.client(to);      // Twilio Client identity
    }
  } else {
    vr.say('Thanks for calling FleetFlow. Please hold while we connect you.');
    dial.client('FleetFlowUser_9351'); // fallback to your client
  }

  res.type('text/xml').send(vr.toString());
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`✅ FleetFlow Token & Voice server running on port ${PORT}`);
});
