// server.js
const session = require('express-session'); // Import the session middleware
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const paymentRoutes = require('./routes/payment');
const { router: webhookRoutes } = require('./routes/webhook');

const app = express();
app.use(session({
  secret: 'fiserv-ipg-stuff',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false
  }
}));

app.use((req, res, next) => {
  
    if (!req.session.reqbody) {
        req.session.reqbody = {};
    }
    next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));


app.use('/api/payment', paymentRoutes);
app.use('/webhook', webhookRoutes);


app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.listen(config.port, () => {
    console.log(`🚀 3DS Payment Server running on port ${config.port}`);
    console.log(`📡 Method Notification URL: ${config.methodNotificationURL}`);
    console.log(`📡 Term URL: ${config.termURL}`);
});
