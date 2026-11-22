const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/transactions - Fetch all transactions
router.get('/', async (req, res) => {
  try {
    // Parameterized queries aren't strictly needed for a simple select all, 
    // but this sets up the pattern. Order by date descending by default.
    const query = `
      SELECT id, TO_CHAR(date, 'YYYY-MM-DD') as date, amount::float8 as amount, description, category, type 
      FROM transactions 
      ORDER BY date DESC, id DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/transactions/filter - Filter transactions by year, month, day
router.get('/filter', async (req, res) => {
  try {
    const { year, month, day } = req.query;
    
    let queryText = `
      SELECT id, TO_CHAR(date, 'YYYY-MM-DD') as date, amount::float8 as amount, description, category, type 
      FROM transactions 
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (year) {
      queryText += ` AND EXTRACT(YEAR FROM date) = $${paramIndex}`;
      values.push(year);
      paramIndex++;
    }
    if (month) {
      queryText += ` AND EXTRACT(MONTH FROM date) = $${paramIndex}`;
      values.push(month);
      paramIndex++;
    }
    if (day) {
      queryText += ` AND EXTRACT(DAY FROM date) = $${paramIndex}`;
      values.push(day);
      paramIndex++;
    }

    queryText += ' ORDER BY date DESC, id DESC';

    const result = await db.query(queryText, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error filtering transactions:', err);
    res.status(500).json({ error: 'Failed to filter transactions' });
  }
});

// POST /api/transactions - Add a single transaction or an array of transactions
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    
    // Normalize input: convert single object to array for uniform processing
    const transactions = Array.isArray(data) ? data : [data];

    if (transactions.length === 0) {
      return res.status(400).json({ error: 'No transaction data provided' });
    }

    const insertedTransactions = [];

    // Use a transaction block (BEGIN/COMMIT) via a dedicated client 
    // to ensure atomicity when inserting multiple rows.
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const t of transactions) {
        const { date, amount, description, category, type } = t;
        
        // Basic validation
        if (!date || amount === undefined || !description || !category || !type) {
          throw new Error('Missing required fields in transaction data');
        }

        const insertQuery = `
          INSERT INTO transactions (date, amount, description, category, type)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, TO_CHAR(date, 'YYYY-MM-DD') as date, amount::float8 as amount, description, category, type
        `;
        const values = [date, amount, description, category, type];
        
        // Use the checked-out client for the query
        const result = await client.query(insertQuery, values);
        insertedTransactions.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e; // Pass to the outer catch block
    } finally {
      client.release();
    }

    // Return the inserted data matching the input format (array vs object)
    res.status(201).json(Array.isArray(data) ? insertedTransactions : insertedTransactions[0]);
    
  } catch (err) {
    console.error('Error inserting transaction(s):', err);
    if (err.message === 'Missing required fields in transaction data') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to insert transaction(s)' });
  }
});

// DELETE /api/transactions - Delete ALL transactions (reset)
router.delete('/', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM transactions');
    res.json({ message: 'All transactions deleted successfully', count: result.rowCount });
  } catch (err) {
    console.error('Error deleting all transactions:', err);
    res.status(500).json({ error: 'Failed to delete all transactions' });
  }
});

// DELETE /api/transactions/:id - Delete a single transaction
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Parameterized query prevents SQL injection
    const deleteQuery = `
      DELETE FROM transactions WHERE id = $1 
      RETURNING id, TO_CHAR(date, 'YYYY-MM-DD') as date, amount::float8 as amount, description, category, type
    `;
    const result = await db.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully', transaction: result.rows[0] });
  } catch (err) {
    console.error('Error deleting transaction:', err);
    // If the ID is an invalid UUID format, pg throws an error. We catch it here.
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;
