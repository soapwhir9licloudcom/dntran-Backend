const express = require('express');
const cors = require('cors');
const { AccessToken } = require('twilio').jwt;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Load credentials from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
const twimlAppSid = process.env.TWIML_APP_SID;



app.get('/token', (req, res) => {
  const identity = 'FleetFlowUser_' + Math.floor(Math.random() * 10000);

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

app.listen(PORT, () => {
  console.log(`Token server running on port ${PORT}`);
});
