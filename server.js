require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

// Import Custom Middleware

// Import Routes
const transactionsRouter = require('./routes/transactions');

// Initialize Express app
const app = express();

// --- Global Middleware ---

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Parse incoming JSON requests
app.use(express.json());

// --- Security Middleware ---

// Apply the API key authentication middleware to all /api routes

// --- Mount Routes (BEFORE static files so API routes take priority) ---

// Delegate all /api/transactions requests to the transactions router
app.use('/api/transactions', transactionsRouter);

// --- Static File Serving ---

// Block access to sensitive files before serving static content
app.use((req, res, next) => {
  const blocked = ['.env', 'server.js', 'package.json', 'package-lock.json', 'schema.sql'];
  const requestedFile = path.basename(req.path);
  if (blocked.includes(requestedFile) || req.path.startsWith('/config') || req.path.startsWith('/middleware') || req.path.startsWith('/routes') || req.path.startsWith('/node_modules')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  next();
});

// Serve static files from the current directory (index.html, styles.css, app.js)
// Serve the FinSight homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.use(express.static(__dirname, {
    dotfiles: 'ignore',
    index: false
}));

// Fallback handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack || err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// --- Server Startup ---

// Listen on PORT from environment variables, fallback to 3000 if not set
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is successfully running on port ${PORT}`);
});
