const express = require('express');
const cors = require('cors');
const { AccessToken } = require('twilio').jwt;
const { VoiceResponse } = require('twilio').twiml;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Load credentials from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKeySid = process.env.TWILIO_API_KEY;
const apiKeySecret = process.env.TWILIO_API_SECRET;
const twimlAppSid = process.env.TWIML_APP_SID;
const CALLER_ID = process.env.CALLER_ID || '+15132245530'; // Default to Number C

// ====== /token endpoint ======
app.get('/token', (req, res) => {
  const identity = 'FleetFlowUser_9351'; // This must match <Client> name

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
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
});

// ====== /voice endpoint ======
app.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const dial = twiml.dial({ callerId: CALLER_ID });
  const to = req.body.To;

  if (to) {
    if (/^[\d\+\-\(\) ]+$/.test(to)) {
      dial.number(to); // Dial phone number
    } else {
      dial.client(to); // Dial client name
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
