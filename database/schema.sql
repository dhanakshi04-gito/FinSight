
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    amount NUMERIC NOT NULL,
    description VARCHAR NOT NULL,
    category VARCHAR NOT NULL,
    type VARCHAR NOT NULL
);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Insert sample expense
INSERT INTO transactions
    (date, amount, description, category, type)
VALUES
    ('2026-04-25', 150.50, 'Grocery Shopping', 'Food', 'Expense');

-- Insert sample income
INSERT INTO transactions
    (date, amount, description, category, type)
VALUES
    ('2026-04-01', 3000.00, 'Monthly Salary', 'Salary', 'Income');
