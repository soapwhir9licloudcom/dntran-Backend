const express = require('express');
const cors = require('cors');
const { AccessToken } = require('twilio').jwt;
const VoiceResponse = require('twilio').twiml.VoiceResponse;
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
const CALLER_ID = process.env.CALLER_ID || '+15132245530'; // <- This should be Number C

// ====== /token endpoint ======
app.get('/token', (req, res) => {
  // FIXED identity to match the client dialed in /voice endpoint
  const identity = 'FleetFlowUser_9351';

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity: identity,
    ttl: 3600,
  });

  token.addGrant(voiceGrant);

  res.json({
    identity: identity,
    token: token.toJwt(),
  });
});

// ====== /voice endpoint (Twilio webhook for incoming calls) ======
app.post('/voice', (req, res) => {
  const twiml = new VoiceResponse();

  const dial = twiml.dial({ callerId: CALLER_ID });

  // If calling a client, use <Client>, otherwise <Number>
  const to = req.body.To;

  if (to) {
    if (/^[\d\+\-\(\) ]+$/.test(to)) {
      dial.number(to);
    } else {
      dial.client(to);
    }
  } else {
    twiml.say("Thanks for calling FleetFlow. Please hold while we connect you.");
    dial.client('FleetFlowUser_9351');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ====== Start server ======
app.listen(PORT, () => {
  console.log(`FleetFlow Token & Voice server running on port ${PORT}`);
});
