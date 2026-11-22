const { Pool } = require('pg');
// Initialize Pool using the DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If you are connecting to a managed database (like Heroku or Supabase), 
  // you may need to uncomment the SSL configuration below:
  ssl: {
    rejectUnauthorized: false,
  },
});
// Handle errors on idle clients
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  process.exit(-1);
});
module.exports = {
  /**
   * Centralized query wrapper to handle database requests cleanly.
   * Logs execution time and catches/logs errors before re-throwing.
   */
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log(`Executed query:`, { text, duration: `${duration}ms`, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', { text, error: error.message });
      throw error;
    }
  },
  // Exporting the raw pool in case manual client checkout is needed for DB transactions
  pool
};
