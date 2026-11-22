/**
 * Express middleware to enforce API Key authentication.
 * Checks the 'x-api-key' header against the API_KEY environment variable.
 */
const apiKeyMiddleware = (req, res, next) => {
  const clientApiKey = req.header('x-api-key');
  const serverApiKey = process.env.API_KEY;

  // Safeguard: Ensure the server has an API key configured
  if (!serverApiKey) {
    console.error('CRITICAL: API_KEY is not defined in the environment variables.');
    return res.status(500).json({ error: 'Internal Server Error: Missing Configuration' });
  }

  // Validate the provided API key
  if (!clientApiKey || clientApiKey !== serverApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }

  // If valid, proceed to the next middleware or route handler
  next();
};

module.exports = apiKeyMiddleware;
