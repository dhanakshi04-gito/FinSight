/* ═══════════════════════════════════════════════════════════════════════════
   app.js — FinSight Analytics
   Client-side application logic. Zero external dependencies.

   HOW THIS FILE IS ORGANISED
   ──────────────────────────
   Each module is clearly separated by a banner comment. Junior developers
   can use Ctrl+F on the module name to jump directly to it.

   MODULE 1 — Constants & Configuration
   MODULE 2 — Application State
   MODULE 3 — LocalStorage Persistence
   MODULE 4 — Transaction Factory
   MODULE 5 — Auto-Classifier (Keyword → Category)
   MODULE 6 — Vanilla CSV Parser
   MODULE 7 — DOM Rendering
   MODULE 8 — Event Listeners & App Startup
   ═══════════════════════════════════════════════════════════════════════════ */


/* ───────────────────────────────────────────────────────────────────────────
   MODULE 1 — CONSTANTS & CONFIGURATION
   ───────────────────────────────────────────────────────────────────────────
   All literal values that might need to change in the future live here.
   Never scatter "magic strings" throughout the code — if the localStorage
   key ever needs to change, you only edit ONE line.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * The single key used to store all transactions in localStorage.
 * Using one key keeps the persistence layer simple: one read, one write.
 */
const STORAGE_KEY = 'finsight_transactions';

/**
 * The key used to store user-customised budget limits in localStorage.
 */
const BUDGET_STORAGE_KEY = 'finsight_budgets';

/**
 * The key used to store imported file metadata (names, counts, timestamps).
 * This powers the "Imported files" list in the CSV section.
 */
const IMPORTED_FILES_KEY = 'finsight_imported_files';

/**
 * CATEGORY_RULES — the classification dictionary.
 *
 * Structure:  { "keyword": "Category Name", ... }
 *
 * HOW MATCHING WORKS:
 *   The autoClassify() function (Module 5) converts the transaction
 *   description to lowercase, then checks whether it *includes* each
 *   keyword string. The first matching keyword wins.
 *
 * EDITING THIS LIST:
 *   To add a new rule, insert a new "keyword": "Category" line.
 *   To add an alias (e.g. both "lyft" and "uber" → "Transport"), add
 *   both as separate entries with the same category value.
 *
 * ORDER MATTERS:
 *   More specific keywords should come before generic ones. For example,
 *   "amazon prime" should appear before "amazon" so membership charges
 *   are not mis-classified as Shopping.
 */
const CATEGORY_RULES = {
    // ── Income ───────────────────────────────────────────────────────────────
    'salary': 'Salary',
    'payroll': 'Salary',
    'wage': 'Salary',
    'freelance': 'Freelance',
    'invoice': 'Freelance',
    'consulting': 'Freelance',
    'dividend': 'Investment',
    'interest': 'Investment',
    'investment': 'Investment',
    'returns': 'Investment',

    // ── Transport ────────────────────────────────────────────────────────────
    'uber': 'Transport',
    'lyft': 'Transport',
    'taxi': 'Transport',
    'auto': 'Transport',
    'rapido': 'Transport',
    'ola': 'Transport',
    'metro': 'Transport',
    'bus': 'Transport',
    'petrol': 'Transport',
    'fuel': 'Transport',
    'parking': 'Transport',
    'train': 'Transport',
    'flight': 'Transport',
    'airfare': 'Transport',

    // ── Food & Dining ────────────────────────────────────────────────────────
    'grocery': 'Food & Dining',
    'groceries': 'Food & Dining',
    'supermarket': 'Food & Dining',
    'walmart': 'Food & Dining',
    'dmart': 'Food & Dining',
    'vegetable': 'Food & Dining',
    'fruit': 'Food & Dining',
    'restaurant': 'Food & Dining',
    'cafe': 'Food & Dining',
    'coffee': 'Food & Dining',
    'dining': 'Food & Dining',
    'pizza': 'Food & Dining',
    'burger': 'Food & Dining',
    'swiggy': 'Food & Dining',
    'zomato': 'Food & Dining',
    'doordash': 'Food & Dining',
    'grubhub': 'Food & Dining',

    // ── Subscriptions ────────────────────────────────────────────────────────
    // NOTE: 'amazon prime' is checked BEFORE 'amazon' to prevent Shopping
    // from capturing streaming charges.
    'amazon prime': 'Subscriptions',
    'netflix': 'Subscriptions',
    'spotify': 'Subscriptions',
    'hulu': 'Subscriptions',
    'apple music': 'Subscriptions',
    'youtube': 'Subscriptions',
    'subscription': 'Subscriptions',
    'membership': 'Subscriptions',

    // ── Shopping ─────────────────────────────────────────────────────────────
    'amazon': 'Shopping',
    'flipkart': 'Shopping',
    'myntra': 'Shopping',
    'ebay': 'Shopping',
    'shopping': 'Shopping',
    'purchase': 'Shopping',

    // ── Housing ──────────────────────────────────────────────────────────────
    'rent': 'Housing',
    'mortgage': 'Housing',
    'apartment': 'Housing',
    'landlord': 'Housing',
    'housing': 'Housing',
    'lease': 'Housing',

    // ── Utilities ────────────────────────────────────────────────────────────
    'electric': 'Utilities',
    'electricity': 'Utilities',
    'water bill': 'Utilities',
    'internet': 'Utilities',
    'gas bill': 'Utilities',
    'phone bill': 'Utilities',
    'utility': 'Utilities',
    'broadband': 'Utilities',

    // ── Healthcare ───────────────────────────────────────────────────────────
    'hospital': 'Healthcare',
    'pharmacy': 'Healthcare',
    'doctor': 'Healthcare',
    'clinic': 'Healthcare',
    'medical': 'Healthcare',
    'health': 'Healthcare',
    'insurance': 'Healthcare',
    'dental': 'Healthcare',
    'dentist': 'Healthcare',

    // ── Education ────────────────────────────────────────────────────────────
    'school': 'Education',
    'college': 'Education',
    'course': 'Education',
    'tuition': 'Education',
    'education': 'Education',
    'udemy': 'Education',
    'coursera': 'Education',
};

/**
 * Categories that represent INCOME. Everything else is treated as an expense.
 * Used by the CSV parser and buildTransaction() to infer type when not explicit.
 */
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Other Income'];

/**
 * A fixed monthly budget limit for each tracked category.
 * Keys must match the category names used in renderBudgetTracker().
 * Units: US Dollars (number).
 */
const BUDGET_LIMITS = {
    'Food & Dining': 15000,
    'Housing': 40000,
    'Transport': 5000,
    'Entertainment': 5000,
    'Utilities': 8000,
    'Healthcare': 10000,
    'Subscriptions': 2000,
    'Education': 15000,
    'Others': 5000
};

/**
 * How many transaction rows to show per page in the history table.
 */
const ROWS_PER_PAGE = 15;


/* ───────────────────────────────────────────────────────────────────────────
   MODULE 2 — APPLICATION STATE
   ───────────────────────────────────────────────────────────────────────────
   The single source of truth for the entire application.
   Every render function reads from here. Every mutation writes here.
   Using a plain object (not a class) keeps it simple to inspect in
   the browser DevTools console: just type "state" and press Enter.
   ─────────────────────────────────────────────────────────────────────────── */

const state = {
    /**
     * The master list of all Transaction objects.
     * Populated by loadFromStorage() on startup, then mutated by
     * addTransaction() and deleteTransaction().
     *
     * @type {Array<Transaction>}
     * where Transaction = {
     *   id:          string,   — unique timestamp key
     *   date:        string,   — YYYY-MM-DD
     *   description: string,
     *   amount:      number,   — always positive float
     *   category:    string,
     *   type:        'income' | 'expense'
     * }
     */
    // Canonical data: everything the user has imported/added.
    transactions: [],

    /**
     * Derived "view" of transactions after applying the active filters.
     * Render functions should use this (not `transactions`) so filters
     * never destroy the underlying dataset.
     * @type {Array<Transaction>}
     */
    viewTransactions: [],

    /**
     * The current page index for transaction table pagination (0-based).
     * Reset to 0 whenever the transaction list changes.
     */
    currentPage: 0,

    /**
     * Current search query for filtering the transaction table.
     * Empty string means no filter applied.
     */
    searchQuery: '',

    /**
     * Currently selected category filter for the transaction table.
     * Empty string means "All Categories".
     */
    filterCategory: '',

    /**
     * Active date filter coming from the Year/Month/Day selects.
     * Empty string means "no filter" for that unit.
     */
    dateFilter: {
        years: [],
        months: [],
        days: []
    },

    /**
     * Metadata about CSV files imported by the user.
     * Persisted in localStorage so the list survives refresh.
     * @type {Array<{name: string, rows: number, importedAt: number}>}
     */
    importedFiles: [],

    /**
     * User-customised budget limits (overrides of BUDGET_LIMITS defaults).
     * Only categories the user has explicitly changed appear here.
     * @type {Object.<string, number>}
     */
    userBudgets: {},

    /**
     * Sorted list of YYYY-MM month strings that have expense data.
     * Rebuilt every time renderBudgetTracker() runs.
     * @type {Array<string>}
     */
    budgetMonths: [],

    /**
     * The currently selected month (YYYY-MM) for the budget tracker.
     * null means "auto" — the most recent month with data.
     * @type {string|null}
     */
    budgetMonth: null,

    /**
     * Set of transaction IDs flagged as statistical anomalies.
     * Recalculated on every render cycle by detectAnomalies().
     * @type {Set<string>}
     */
    anomalyIds: new Set(),

    /**
     * Per-transaction anomaly statistics (mean, stdDev, zScore, month).
     * Only populated for transactions in anomalyIds.
     * @type {Object.<string, {mean: number, stdDev: number, zScore: number, month: string}>}
     */
    anomalyStats: {},

    /**
     * Chart.js instances. Stored here so they can be destroyed before
     * re-rendering to prevent canvas reuse errors.
     */
    chartInstances: {
        spendingTrend: null,
        categoryBreakdown: null,
        budgetVsActual: null
    }
};


/* ───────────────────────────────────────────────────────────────────────────
   MODULE 3 — BACKEND API & PERSISTENCE
   ─────────────────────────────────────────────────────────────────────────── */

const API_BASE_URL = 'http://localhost:3000';

const API_HEADERS = {
    'Content-Type': 'application/json'
};

async function getTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions`, { headers: API_HEADERS });
        if (response.ok) {
            const data = await response.json();
            // Normalize type to lowercase — DB stores "Income"/"Expense" but
            // frontend logic compares against "income"/"expense".
            return data.map(t => ({ ...t, type: t.type ? t.type.toLowerCase() : t.type }));
        }
        console.error('Failed to load transactions');
        return [];
    } catch (e) {
        console.error('API Error', e);
        return [];
    }
}

async function addTransaction(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify(data)
        });
        if (response.ok) return await response.json();
        console.error('Failed to post transaction');
        return null;
    } catch (e) {
        console.error('API Post Error', e);
        return null;
    }
}

async function deleteTransaction(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions/${id}`, {
            method: 'DELETE',
            headers: API_HEADERS
        });
        if (!response.ok) console.error('Failed to delete transaction');
        return response.ok;
    } catch (e) {
        console.error('API Delete Error', e);
        return false;
    }
}

async function filterTransactions(year, month, day) {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    if (day) params.append('day', day);

    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions/filter?${params.toString()}`, {
            headers: API_HEADERS
        });
        if (response.ok) {
            const data = await response.json();
            return data.map(t => ({ ...t, type: t.type ? t.type.toLowerCase() : t.type }));
        }
        console.error('Filter API returned error');
        return [];
    } catch (e) {
        console.error('Fail to hit filter API', e);
        return [];
    }
}

function saveToStorage() { }

function saveBudgetsToStorage() {
    const jsonString = JSON.stringify(state.userBudgets);
    localStorage.setItem(BUDGET_STORAGE_KEY, jsonString);
}

function saveImportedFilesToStorage() {
    try {
        localStorage.setItem(IMPORTED_FILES_KEY, JSON.stringify(state.importedFiles));
    } catch (e) {
        // If storage quota is exceeded, we just don't persist the list.
        console.warn('Failed to persist imported files list.', e);
    }
}

function loadImportedFilesFromStorage() {
    const raw = localStorage.getItem(IMPORTED_FILES_KEY);
    if (!raw) {
        state.importedFiles = [];
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            state.importedFiles = parsed
                .filter(x => x && typeof x === 'object' && typeof x.name === 'string')
                .map(x => ({
                    name: x.name,
                    rows: Number.isFinite(x.rows) ? x.rows : 0,
                    importedAt: Number.isFinite(x.importedAt) ? x.importedAt : Date.now()
                }));
        } else {
            state.importedFiles = [];
        }
    } catch (e) {
        state.importedFiles = [];
    }
}

function renderImportedFilesPanel() {
    const listEl = document.getElementById('imported-files-list');
    const emptyEl = document.getElementById('imported-files-empty');
    if (!listEl || !emptyEl) return;

    listEl.innerHTML = '';
    const files = Array.isArray(state.importedFiles) ? state.importedFiles.slice() : [];
    files.sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));

    if (files.length === 0) {
        emptyEl.style.display = '';
        return;
    }

    emptyEl.style.display = 'none';
    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const li = document.createElement('li');
        li.className = 'imported-files__item';

        const name = f.name || 'Unnamed file';
        const rows = Number.isFinite(f.rows) ? f.rows : 0;
        const when = new Date(f.importedAt || Date.now()).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        li.innerHTML = `
          <span class="imported-files__name">${escapeHTML(name)}</span>
          <span class="imported-files__meta">${rows} row(s) · ${escapeHTML(when)}</span>
        `;
        listEl.appendChild(li);
    }
}

function loadBudgetsFromStorage() {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (raw === null) {
        state.userBudgets = {};
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            state.userBudgets = parsed;
        } else {
            state.userBudgets = {};
        }
    } catch (error) {
        state.userBudgets = {};
    }
}

function getBudgetLimit(categoryName) {
    if (state.userBudgets.hasOwnProperty(categoryName)) {
        return state.userBudgets[categoryName];
    }
    return BUDGET_LIMITS[categoryName] || 0;
}


/* ───────────────────────────────────────────────────────────────────────────
   MODULE 4 — TRANSACTION FACTORY
   ───────────────────────────────────────────────────────────────────────────
   One function responsible for constructing a clean Transaction object.
   By centralising object creation here, we guarantee that every
   transaction in state.transactions has the same shape — no missing keys,
   no unexpected types.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Constructs a normalised Transaction object from raw input values.
 *
 * @param {string} date        — Raw date string from form or CSV ("2024-04-12")
 * @param {string} description — Human-readable description of the transaction
 * @param {string|number} amount — The monetary value (will be coerced to float)
 * @param {string} type        — 'income' or 'expense'
 * @param {string} [category]  — Optional. If omitted, autoClassify() is called.
 * @returns {Object} A fully-formed Transaction object
 */
function buildTransaction(date, description, amount, type, category) {
    const isoDate = new Date(date).toISOString().split('T')[0];

    const cleanedAmount = String(amount).replace(/[₹$,]/g, '');
    const floatAmount = parseFloat(cleanedAmount);

    const cleanDescription = String(description).trim();

    const resolvedCategory = (category && category.trim() !== '')
        ? category.trim()
        : autoClassify(cleanDescription);

    const resolvedType = (type && type.trim() !== '')
        ? type.trim()
        : (INCOME_CATEGORIES.includes(resolvedCategory) ? 'income' : 'expense');

    return {
        date: isoDate,
        description: cleanDescription,
        amount: floatAmount,
        category: resolvedCategory,
        type: resolvedType,  // 'income' | 'expense'
    };
}


/* ───────────────────────────────────────────────────────────────────────────
   MODULE 5 — AUTO-CLASSIFIER (Keyword → Category)
   ───────────────────────────────────────────────────────────────────────────
   Deterministic, rule-based categorisation. No machine learning,
   no regular expressions — just plain string inclusion checks.
   Easy for any junior developer to understand and extend.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Automatically assigns a category to a transaction based on its description.
 *
 * HOW IT WORKS:
 *   1. Convert the description to lowercase (so "Uber" matches "uber")
 *   2. Iterate through every key in CATEGORY_RULES
 *   3. Check if the description *includes* that keyword
 *   4. Return the category for the first matching keyword
 *   5. If nothing matches, return 'Others' as the fallback
 *
 * WHY .includes() and not regex:
 *   .includes() is a simple, readable substring search that junior
 *   developers can immediately understand. It does the same job as a
 *   basic regex match for our use case, with zero syntax complexity.
 *
 * WHY the fallback matters:
 *   Uncategorised transactions are still valid data. Falling back to
 *   'Others' keeps them in the dataset rather than discarding them.
 *
 * @param {string} description — The transaction description
 * @returns {string}           — A category name string
 */
function autoClassify(description) {
    // Step 1: Normalise to lowercase so comparisons are case-insensitive.
    const lowerDescription = description.toLowerCase();

    // Step 2 & 3: Iterate through every rule in the dictionary.
    // Object.keys() returns the keys in insertion order.
    const keywords = Object.keys(CATEGORY_RULES);

    for (let i = 0; i < keywords.length; i++) {
        const keyword = keywords[i];
        const category = CATEGORY_RULES[keyword];

        // Step 3: The core check. If the description contains this keyword…
        if (lowerDescription.includes(keyword)) {
            // Step 4: …return the matching category immediately (first match wins).
            return category;
        }
    }

    // Step 5: No keyword matched — use the fallback category.
    return 'Others';
}


/* ───────────────────────────────────────────────────────────────────────────
   MODULE 6 — VANILLA CSV PARSER
   ───────────────────────────────────────────────────────────────────────────
   A bespoke CSV parser using only the HTML5 FileReader API and basic
   string methods. No external libraries (PapaParse, csv-parse, etc.).
   Prioritises readable loops over dense one-liners.

   KNOWN LIMITATION:
     This parser splits each row on commas. It does NOT handle the case
     where a field *value* contains a comma and is wrapped in double-quotes
     (e.g. "Big Store, Corp"). Such values would be incorrectly split.
     For basic bank exports this is rarely an issue. A quoted-field parser
     can be added in a future iteration if needed.

   EXPECTED CSV FORMAT:
     Row 0 (header): Date, Description, Amount, Category
     Rows 1–n:       2024-04-01, Uber ride, 12.50, Transport
     Column order is determined by reading the header row dynamically,
     so columns can appear in any order as long as the header names match.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Parses raw CSV text into an array of plain row objects.
 *
 * @param {string} rawText — The full file contents as a string
 * @returns {Array<Object>} — Array of { date, description, amount, category }
 */
function parseCSV(rawText) {
    // ── Step 1: Split the raw text into individual lines ───────────────────
    // '\n' is the line separator on Mac/Linux. Windows files use '\r\n'.
    // We handle both by trimming each row (which removes \r) in Step 3.
    const allLines = rawText.split('\n');

    // ── Step 2: Remove blank lines ─────────────────────────────────────────
    // An empty line after trimming means it's whitespace-only. Filter it out
    // to avoid processing phantom empty rows at the end of the file.
    const nonEmptyLines = [];
    for (let i = 0; i < allLines.length; i++) {
        if (allLines[i].trim() !== '') {
            nonEmptyLines.push(allLines[i].trim());
        }
    }

    // If the file had no content at all, return early.
    if (nonEmptyLines.length === 0) {
        console.warn('FinSight CSV: File appears to be empty.');
        return [];
    }

    // ── Step 3: Parse the header row ───────────────────────────────────────
    // The first line is the header. Split it by comma and lowercase each
    // header name so we can match 'Date', 'DATE', 'date' identically.
    const headerCells = nonEmptyLines[0].split(',');
    const headers = [];
    for (let h = 0; h < headerCells.length; h++) {
        headers.push(headerCells[h].trim().toLowerCase());
    }

    // Find the column index for each expected field.
    // If a column isn't found, indexOf returns -1. We handle that in Step 5.
    const dateIndex = headers.indexOf('date');
    const descriptionIndex = headers.indexOf('description');
    const amountIndex = headers.indexOf('amount');
    const categoryIndex = headers.indexOf('category');   // optional column
    const typeIndex = headers.indexOf('type');           // optional column

    // Warn if any essential column is missing.
    if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
        console.warn(
            'FinSight CSV: Missing required column(s). Expected: Date, Description, Amount.',
            'Found headers:', headers
        );
        return [];
    }

    // ── Step 4: Parse each data row ────────────────────────────────────────
    // We start the loop at index 1 to skip the header row we just processed.
    const parsedRows = [];

    for (let rowIndex = 1; rowIndex < nonEmptyLines.length; rowIndex++) {
        const line = nonEmptyLines[rowIndex];
        const cells = line.split(',');

        // Trim whitespace from every cell value.
        const trimmedCells = [];
        for (let c = 0; c < cells.length; c++) {
            trimmedCells.push(cells[c].trim());
        }

        // ── Step 5: Extract & validate individual fields ──────────────────────
        const rawDate = trimmedCells[dateIndex] || '';
        const rawDescription = trimmedCells[descriptionIndex] || '';
        const rawAmount = trimmedCells[amountIndex] || '';
        // Category column is optional — may not exist in every bank export.
        const rawCategory = (categoryIndex !== -1) ? (trimmedCells[categoryIndex] || '') : '';

        // Skip rows where the amount isn't a valid number after stripping
        // currency symbols and commas (e.g. "$1,200" → "1200").
        const cleanedAmount = rawAmount.replace(/[$,]/g, '');
        if (isNaN(parseFloat(cleanedAmount)) || cleanedAmount === '') {
            // Log at row number (adding 1 for the header, another 1 for 1-based display)
            console.warn('FinSight CSV: Skipping row ' + (rowIndex + 1) + ' — invalid amount: "' + rawAmount + '"');
            continue; // Move to the next row
        }

        // ── Step 6: Determine transaction type ────────────────────────────────
        const numericAmount = parseFloat(cleanedAmount);

        let type;
        if (typeIndex !== -1) {
            // Explicit type column present — use it directly.
            const rawType = trimmedCells[typeIndex].toLowerCase();
            type = (rawType === 'income' || rawType === 'credit' || rawType === 'cr' || rawType === 'deposit') ? 'income' : 'expense';
        } else if (numericAmount < 0) {
            // Negative amount is always an expense.
            type = 'expense';
        } else {
            // No type column + positive amount: infer from category.
            // Auto-classify the description to get a category, then check
            // whether that category is an income category.
            const inferredCategory = (rawCategory && rawCategory.trim() !== '')
                ? rawCategory.trim()
                : autoClassify(rawDescription);
            type = INCOME_CATEGORIES.includes(inferredCategory) ? 'income' : 'expense';
        }

        // Assemble a clean row object and add it to our results.
        parsedRows.push({
            date: rawDate,
            description: rawDescription,
            amount: Math.abs(numericAmount),  // always positive; type conveys direction
            category: rawCategory,
            type: type,
        });
    }

    return parsedRows;
}

/**
 * Reads a File object using the HTML5 FileReader API and processes it
 * through the CSV parser pipeline.
 *
 * WHY this is a separate function from parseCSV:
 *   parseCSV() is a pure function — it transforms text to data with no side
 *   effects. readAndProcessCSV() handles the async I/O and then delegates
 *   the actual parsing. Keeping them separate makes both easier to test.
 *
 * @param {File} file — A File object from an <input type="file"> or drop event
 */
function readAndProcessCSV(file) {
    // Validate that a file was actually provided.
    if (!file) {
        return;
    }

    // Show loading feedback to the user.
    const statusEl = document.getElementById('csv-upload-status');
    if (statusEl) {
        statusEl.textContent = 'Reading file…';
    }

    // FileReader is the browser's built-in API for reading local files.
    // It works asynchronously — we set up a callback (.onload) which is
    // called when the read operation completes.
    const reader = new FileReader();

    // .onload fires when the file has been fully read into memory.
    reader.onload = async function (event) {
        // event.target.result contains the file's full text content as a string.
        const rawText = event.target.result;
        const rows = parseCSV(rawText);

        if (rows.length === 0) {
            if (statusEl) {
                statusEl.textContent = 'No valid transactions found in the file. Check the column headers.';
            }
            return;
        }

        let newTransactions = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const transaction = buildTransaction(
                row.date,
                row.description,
                row.amount,
                row.type,
                row.category
            );
            newTransactions.push(transaction);
        }

        // Bulk post to backend
        let addedCount = 0;
        const inserted = await addTransaction(newTransactions);
        if (inserted) {
            const insertedArray = Array.isArray(inserted) ? inserted : [inserted];
            state.transactions.push(...insertedArray);
            addedCount = insertedArray.length;
        } else {
            if (statusEl) {
                statusEl.textContent = 'Failed to save to backend.';
            }
            return;
        }

        // Track imported file in the UI list (persisted)
        const fileName = file && file.name ? file.name : 'Imported CSV';
        const existingIdx = state.importedFiles.findIndex(f => (f.name || '').toLowerCase() === fileName.toLowerCase());
        const entry = { name: fileName, rows: addedCount, importedAt: Date.now() };
        if (existingIdx >= 0) {
            state.importedFiles[existingIdx] = entry;
        } else {
            state.importedFiles.push(entry);
        }
        saveImportedFilesToStorage();

        state.currentPage = 0;
        renderAll();

        if (statusEl) {
            statusEl.textContent = 'Successfully imported ' + addedCount + ' transaction(s).';
        }
    };

    // .onerror fires if the file cannot be read (e.g. permissions issue).
    reader.onerror = function () {
        console.error('FinSight: FileReader error while reading CSV.');
        if (statusEl) {
            statusEl.textContent = 'Error reading file. Please try again.';
        }
    };

    // Kick off the asynchronous read. 'readAsText' decodes the file as a
    // UTF-8 text string, which is correct for CSV files.
    reader.readAsText(file);
}


/* ───────────────────────────────────────────────────────────────────────────
   MODULE 7 — DOM RENDERING
   ───────────────────────────────────────────────────────────────────────────
   Each render function is responsible for exactly one section of the UI.
   They all read from state and write to the DOM. They are "pure renders" in
   the sense that they do not modify state — they only reflect it.

   STRATEGY: Clear and Rebuild
   Each render function empties its target element and rebuilds it from
   scratch on every call. This is deliberately simple:
     - Easy to reason about (no partial updates, no stale UI)
     - No diffing algorithm needed
     - Performance is fine for personal finance data volumes
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Master render coordinator. Calls every individual render function.
 * All state mutations should end with renderAll() so the UI stays
 * in sync with state in one predictable step.
 */
function renderAll() {
    state.viewTransactions = getViewTransactions();
    detectAnomalies();
    renderMetricsBar();
    renderMonthlyOverview();
    renderTransactionList();
    renderBudgetTracker();
    renderAnomalyAlerts();
    renderAnalytics();
    renderImportedFilesPanel();
}

/**
 * Returns a filtered view of the canonical dataset (`state.transactions`)
 * based on the active UI filters (search, category, year/month/day).
 *
 * Important: this function is PURE (no state mutation).
 */
function getViewTransactions() {
    let filtered = state.transactions.slice();

    // Global date filter (year/month/day)
    const { years, months, days } = state.dateFilter || {};
    if (Array.isArray(years) && years.length > 0) {
        const yearSet = new Set(years.map(String));
        filtered = filtered.filter(txn => txn.date && yearSet.has(txn.date.substring(0, 4)));
    }
    if (Array.isArray(months) && months.length > 0) {
        const monthSet = new Set(months.map(m => String(m).padStart(2, '0')));
        filtered = filtered.filter(txn => txn.date && monthSet.has(txn.date.substring(5, 7)));
    }
    if (Array.isArray(days) && days.length > 0) {
        const daySet = new Set(days.map(d => String(d).padStart(2, '0')));
        filtered = filtered.filter(txn => txn.date && daySet.has(txn.date.substring(8, 10)));
    }

    // Search query (applies to list + analytics to keep UX consistent)
    if (state.searchQuery && state.searchQuery.trim() !== '') {
        const query = state.searchQuery.trim().toLowerCase();
        filtered = filtered.filter(function (txn) {
            return txn.description.toLowerCase().includes(query)
                || txn.category.toLowerCase().includes(query)
                || txn.date.includes(query)
                || String(txn.amount).includes(query);
        });
    }

    // Category filter (applies globally)
    if (state.filterCategory && state.filterCategory !== '') {
        const filterCat = state.filterCategory.toLowerCase();
        filtered = filtered.filter(function (txn) {
            return txn.category.toLowerCase() === filterCat;
        });
    }

    return filtered;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7a-pre — Anomaly Detection (Z-Score)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs Z-Score anomaly detection on expenses grouped by MONTH.
 *
 * WHY PER-MONTH:
 *   Pooling all expenses across the year inflates the standard deviation,
 *   masking genuinely unusual spending within a given month. By computing
 *   stats per month, a ₹45,000 vacation is correctly flagged as unusual in
 *   a month where everything else is ₹500–₹6,000, even though a ₹35,000
 *   rent appears every month.
 *
 * Math (applied independently to each month):
 *   μ  = mean of that month's expense amounts
 *   σ  = standard deviation
 *   Z  = (amount - μ) / σ
 *   Anomaly if |Z| > 2.0
 *
 * Results are stored in:
 *   state.anomalyIds   — Set of flagged transaction IDs
 *   state.anomalyStats — Map of txn ID → { mean, stdDev, zScore, month }
 */
function detectAnomalies() {
    state.anomalyIds = new Set();
    state.anomalyStats = {};

    const expenses = state.viewTransactions.filter(t => t.type === 'expense');
    if (expenses.length < 3) return;

    // ── Group expenses by YYYY-MM ──────────────────────────────────────────
    const monthGroups = {};
    for (let i = 0; i < expenses.length; i++) {
        const txn = expenses[i];
        const month = txn.date.substring(0, 7); // "YYYY-MM"
        if (!monthGroups[month]) {
            monthGroups[month] = [];
        }
        monthGroups[month].push(txn);
    }

    // ── Analyse each month independently ───────────────────────────────────
    const months = Object.keys(monthGroups);
    for (let m = 0; m < months.length; m++) {
        const month = months[m];
        const group = monthGroups[month];

        // Need at least 3 transactions in a month for meaningful stats
        if (group.length < 3) continue;

        const amounts = group.map(t => t.amount);
        const N = amounts.length;

        // Mean (μ)
        const mean = amounts.reduce((sum, val) => sum + val, 0) / N;

        // Standard Deviation (σ)
        const variance = amounts.reduce((sum, val) => {
            const d = val - mean;
            return sum + d * d;
        }, 0) / N;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) continue; // All amounts identical in this month

        // Flag transactions with |Z| > 2.0
        for (let i = 0; i < group.length; i++) {
            const txn = group[i];
            const zScore = (txn.amount - mean) / stdDev;
            if (Math.abs(zScore) > 2.0) {
                state.anomalyIds.add(txn.id);
                state.anomalyStats[txn.id] = {
                    mean: mean,
                    stdDev: stdDev,
                    zScore: zScore,
                    month: month
                };
            }
        }
    }
}

/**
 * Renders the anomaly alerts panel. Shows flagged transactions with
 * their Z-score values, amounts, and descriptions. Hidden when no
 * anomalies are detected.
 */
function renderAnomalyAlerts() {
    const section = document.getElementById('anomaly-alerts-section');
    const container = document.getElementById('anomaly-alerts-container');
    if (!section || !container) return;

    // Hide section entirely if no anomalies
    if (state.anomalyIds.size === 0) {
        section.setAttribute('hidden', '');
        return;
    }
    section.removeAttribute('hidden');

    // Build anomaly cards
    container.innerHTML = '';

    const anomalyTxns = state.viewTransactions.filter(t => state.anomalyIds.has(t.id));

    // Sort by absolute Z-score descending (most extreme first)
    anomalyTxns.sort(function (a, b) {
        const statsA = state.anomalyStats[a.id];
        const statsB = state.anomalyStats[b.id];
        return Math.abs(statsB.zScore) - Math.abs(statsA.zScore);
    });

    for (let i = 0; i < anomalyTxns.length; i++) {
        const txn = anomalyTxns[i];
        const stats = state.anomalyStats[txn.id];

        // Safety guard: skip if stats are missing or Z-score is below threshold
        if (!stats || Math.abs(stats.zScore) < 2.0) continue;

        const absZ = Math.abs(stats.zScore).toFixed(2);

        // Format month for display (e.g. "2025-07" → "Jul 2025")
        const monthDate = new Date(stats.month + '-01');
        const monthLabel = monthDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

        // Determine severity level
        let severityClass = 'anomaly-card--warning';
        let severityLabel = 'Unusual';
        if (Math.abs(stats.zScore) > 3.0) {
            severityClass = 'anomaly-card--critical';
            severityLabel = 'Critical';
        }

        const card = document.createElement('div');
        card.className = 'anomaly-card ' + severityClass;
        card.innerHTML = `
          <div class="anomaly-card__header">
            <span class="anomaly-card__severity">${severityLabel}</span>
            <span class="anomaly-card__zscore">Z-score: ${absZ}</span>
          </div>
          <div class="anomaly-card__body">
            <div class="anomaly-card__info">
              <span class="anomaly-card__description">${escapeHTML(txn.description)}</span>
              <span class="anomaly-card__meta">${escapeHTML(txn.date)} · ${escapeHTML(txn.category)}</span>
            </div>
            <span class="anomaly-card__amount">${formatCurrency(txn.amount)}</span>
          </div>
          <div class="anomaly-card__context">
            <span>${monthLabel} avg: ${formatCurrency(stats.mean)}</span>
            <span>This is <strong>${(txn.amount / stats.mean).toFixed(1)}×</strong> the monthly average</span>
          </div>
        `;
        container.appendChild(card);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7a — Render Metrics Bar (Header KPI Cards)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates summary metrics from state.transactions and writes them
 * into the four KPI card <span> elements in the header.
 */
function renderMetricsBar() {
    // ── Calculations ────────────────────────────────────────────────────────
    let totalIncome = 0;
    let totalExpense = 0;

    // Iterate once through all transactions to accumulate totals.
    for (let i = 0; i < state.viewTransactions.length; i++) {
        const txn = state.viewTransactions[i];
        if (txn.type === 'income') {
            totalIncome += txn.amount;
        } else {
            totalExpense += txn.amount;
        }
    }

    const netBalance = totalIncome - totalExpense;
    // Savings rate: what percentage of income was not spent?
    // Guard against division-by-zero when there's no income yet.
    const savingsRate = totalIncome > 0
        ? ((netBalance / totalIncome) * 100).toFixed(1)
        : '0.0';

    // ── DOM Updates ─────────────────────────────────────────────────────────
    // formatCurrency() is defined below — turns 1234.5 into "$1,234.50"
    setText('metric-balance', formatCurrency(netBalance));
    setText('metric-income', formatCurrency(totalIncome));
    setText('metric-expenses', formatCurrency(totalExpense));
    setText('metric-savings-rate', savingsRate + '%');

    // Colour-code net balance: positive = accent, negative = danger
    const balanceEl = document.getElementById('metric-balance');
    if (balanceEl) {
        balanceEl.classList.remove('metric-card__value--positive', 'metric-card__value--danger');
        balanceEl.classList.add(netBalance >= 0
            ? 'metric-card__value--positive'
            : 'metric-card__value--danger'
        );
    }

    // ── Anomaly count in the savings delta slot ───────────────────────────
    const anomalyCount = state.anomalyIds.size;
    const savingsDelta = document.getElementById('metric-savings-delta');
    if (savingsDelta) {
        if (anomalyCount > 0) {
            savingsDelta.textContent = '⚠ ' + anomalyCount + ' anomal' + (anomalyCount === 1 ? 'y' : 'ies') + ' detected';
            savingsDelta.style.color = 'var(--color-danger)';
        } else {
            savingsDelta.textContent = 'No anomalies';
            savingsDelta.style.color = '';
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7b — Render Transaction List (History Table)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rebuilds the transaction history <tbody> from state.transactions,
 * applying the current page offset from state.currentPage.
 */
function renderTransactionList() {
    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) return;

    // Filters are applied globally in renderAll() via state.viewTransactions
    let filtered = state.viewTransactions.slice();

    // Sort: most recent first (descending by date string — ISO dates sort correctly)
    const sorted = filtered.sort(function (a, b) {
        return b.date.localeCompare(a.date);
    });

    // ── Pagination ────────────────────────────────────────────────────────
    const totalRows = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / ROWS_PER_PAGE));
    // Clamp currentPage in case transactions were deleted and the page
    // index is now out of range.
    state.currentPage = Math.min(state.currentPage, totalPages - 1);

    const startIndex = state.currentPage * ROWS_PER_PAGE;
    const pageRows = sorted.slice(startIndex, startIndex + ROWS_PER_PAGE);

    // Update pagination controls
    const pageIndicator = document.getElementById('page-indicator');
    if (pageIndicator) {
        pageIndicator.textContent = 'Page ' + (state.currentPage + 1) + ' of ' + totalPages;
    }
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    if (prevBtn) prevBtn.disabled = (state.currentPage === 0);
    if (nextBtn) nextBtn.disabled = (state.currentPage >= totalPages - 1);

    // ── Clear existing rows ───────────────────────────────────────────────
    tbody.innerHTML = '';

    // ── Empty state ───────────────────────────────────────────────────────
    if (pageRows.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'table-empty-row';
        emptyRow.innerHTML = `
      <td colspan="7" class="table-empty-cell">
        <div class="table-empty">
          <svg class="table-empty__icon" viewBox="0 0 48 48" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="12" width="32" height="28" rx="3" stroke="currentColor" stroke-width="2"/>
            <path d="M16 12V9a2 2 0 012-2h12a2 2 0 012 2v3" stroke="currentColor" stroke-width="2"/>
            <line x1="16" y1="22" x2="32" y2="22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="16" y1="28" x2="26" y2="28" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          <p>No transactions yet. Add one above or import a CSV.</p>
        </div>
      </td>
    `;
        tbody.appendChild(emptyRow);
        return;
    }

    // ── Build one <tr> per transaction ───────────────────────────────────
    for (let i = 0; i < pageRows.length; i++) {
        const txn = pageRows[i];
        const row = document.createElement('tr');
        const isAnomaly = state.anomalyIds.has(txn.id);

        // Add anomaly class to the row for visual highlighting
        if (isAnomaly) {
            row.className = 'anomaly-row';
        }

        // Colour-code the amount: green for income, neutral-white for expense
        const amountClass = txn.type === 'income' ? 'amount-positive' : (isAnomaly ? 'amount-danger' : 'amount-expense');
        const amountSign = txn.type === 'income' ? '+' : '−';

        // Type badge: pill-shaped label
        const typeBadgeClass = txn.type === 'income' ? 'badge badge--income' : 'badge badge--expense';

        // Status column: anomaly warning or empty
        const statusHTML = isAnomaly
            ? '<span class="badge badge--anomaly" title="Unusual spending detected (Z-score > 2.0)">⚠ Anomaly</span>'
            : '';

        row.innerHTML = `
      <td class="col-date">${escapeHTML(txn.date)}</td>
      <td class="col-description">${escapeHTML(txn.description)}</td>
      <td class="col-category">
        <span class="category-tag">${escapeHTML(txn.category)}</span>
      </td>
      <td class="col-amount ${amountClass}">
        ${amountSign}${formatCurrency(txn.amount)}
      </td>
      <td class="col-type">
        <span class="${typeBadgeClass}">${escapeHTML(txn.type)}</span>
      </td>
      <td class="col-status">${statusHTML}</td>
      <td class="col-actions">
        <button
          class="btn btn--ghost btn--sm btn-delete"
          data-id="${escapeHTML(txn.id)}"
          aria-label="Delete transaction: ${escapeHTML(txn.description)}"
        >✕</button>
      </td>
    `;
        tbody.appendChild(row);
    }

    // Attach delete listeners to all newly-created delete buttons.
    // We bind after building the DOM so each button has access to its txn id.
    const deleteButtons = tbody.querySelectorAll('.btn-delete');
    for (let b = 0; b < deleteButtons.length; b++) {
        deleteButtons[b].addEventListener('click', handleDeleteTransaction);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7b2 — Render Monthly Overview
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders the Monthly Overview section. Shows a year dropdown and a grid
 * of 12 month cards. Each card is coloured green or red based on whether
 * total expenses for that month exceed the combined monthly budget
 * (sum of all category budget limits).
 *
 * Clicking a month card scrolls to the Budget Tracker section and sets
 * it to display that specific month.
 */
function renderMonthlyOverview() {
    const yearSelect = document.getElementById('overview-year-select');
    const grid = document.getElementById('monthly-overview-grid');
    if (!yearSelect || !grid) return;

    // ── Compute the total monthly budget limit (sum of all categories) ────
    const totalMonthlyBudget = Object.keys(BUDGET_LIMITS).reduce(function (sum, cat) {
        return sum + getBudgetLimit(cat);
    }, 0);

    // ── Collect available years from ALL transactions (not filtered) ──────
    const yearSet = new Set();
    for (let i = 0; i < state.transactions.length; i++) {
        const txn = state.transactions[i];
        if (txn.date && txn.date.length >= 4) {
            yearSet.add(txn.date.substring(0, 4));
        }
    }
    const availableYears = Array.from(yearSet).sort().reverse();

    // ── Populate year dropdown (preserve current selection if possible) ───
    const currentSelection = yearSelect.value;
    yearSelect.innerHTML = '';

    if (availableYears.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No data';
        yearSelect.appendChild(opt);
        grid.innerHTML = '<div class="monthly-overview__empty">No transaction data available. Add or import transactions to see the monthly overview.</div>';
        return;
    }

    for (let i = 0; i < availableYears.length; i++) {
        const opt = document.createElement('option');
        opt.value = availableYears[i];
        opt.textContent = availableYears[i];
        yearSelect.appendChild(opt);
    }

    // Restore previous selection or default to first (most recent) year
    if (currentSelection && availableYears.includes(currentSelection)) {
        yearSelect.value = currentSelection;
    } else {
        yearSelect.value = availableYears[0];
    }

    const selectedYear = yearSelect.value;

    // ── Sum expenses per month for the selected year ─────────────────────
    const monthlyExpenses = {}; // { '01': totalAmount, '02': totalAmount, ... }
    for (let i = 0; i < state.transactions.length; i++) {
        const txn = state.transactions[i];
        if (txn.type !== 'expense') continue;
        if (!txn.date || !txn.date.startsWith(selectedYear)) continue;
        const monthNum = txn.date.substring(5, 7); // '01'..'12'
        monthlyExpenses[monthNum] = (monthlyExpenses[monthNum] || 0) + txn.amount;
    }

    // ── Build month cards ────────────────────────────────────────────────
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    grid.innerHTML = '';

    for (let m = 0; m < 12; m++) {
        const monthKey = String(m + 1).padStart(2, '0');
        const spent = monthlyExpenses[monthKey] || 0;
        const hasData = spent > 0;
        const exceeded = hasData && spent > totalMonthlyBudget;
        const delta = Math.abs(spent - totalMonthlyBudget);

        const card = document.createElement('div');
        let statusClass = 'month-card--empty';
        if (hasData) {
            statusClass = exceeded ? 'month-card--exceeded' : 'month-card--within';
        }
        card.className = 'month-card ' + statusClass;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', hasData ? '0' : '-1');
        card.setAttribute('aria-label', monthNames[m] + ' ' + selectedYear +
            (hasData ? (exceeded ? ' — Budget exceeded' : ' — Within budget') : ' — No data'));

        // Left side: month name + spent amount
        let spentText = hasData ? 'Spent: ' + formatCurrency(spent) : 'No expenses';

        // Right side: status + delta amount
        let statusHTML = '';
        if (hasData) {
            if (exceeded) {
                statusHTML = `
                    <span class="month-card__status month-card__status--exceeded">Exceeded</span>
                    <span class="month-card__delta month-card__delta--over">+${formatCurrency(delta)} over</span>
                `;
            } else {
                statusHTML = `
                    <span class="month-card__status month-card__status--within">Within</span>
                    <span class="month-card__delta month-card__delta--under">${formatCurrency(delta)} left</span>
                `;
            }
        }

        // Arrow icon for clickable cards
        const arrowSVG = hasData ? `
            <svg class="month-card__arrow" viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
                <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        ` : '';

        card.innerHTML = `
            <div class="month-card__left">
                <span class="month-card__name">${escapeHTML(monthNames[m])}</span>
                <span class="month-card__spent">${spentText}</span>
            </div>
            <div class="month-card__right">
                ${statusHTML}
            </div>
            ${arrowSVG}
        `;

        // ── Click handler: navigate to budget tracker for this month ──────
        if (hasData) {
            const targetMonth = selectedYear + '-' + monthKey;
            card.addEventListener('click', function () {
                // Set budget month and re-render the budget tracker
                state.budgetMonth = targetMonth;

                // Ensure the target month is in budgetMonths so the slider works
                if (!state.budgetMonths.includes(targetMonth)) {
                    state.budgetMonths.push(targetMonth);
                    state.budgetMonths.sort();
                }

                renderBudgetTracker();
                renderAnalytics();

                // Scroll to the budget section
                const budgetSection = document.getElementById('budget-summary');
                if (budgetSection) {
                    budgetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });

            // Keyboard accessibility
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        }

        grid.appendChild(card);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7c — Render Budget Tracker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates actual spending per category for the current calendar month,
 * then updates the four budget progress bars and overrun warning.
 */
function renderBudgetTracker() {
    const container = document.getElementById('budget-items-container');
    if (!container) return;

    // ── Collect all months that have expense data ─────────────────────────
    const monthSet = new Set();
    for (let i = 0; i < state.viewTransactions.length; i++) {
        const txn = state.viewTransactions[i];
        if (txn.type !== 'expense') continue;
        monthSet.add(txn.date.substring(0, 7));
    }
    state.budgetMonths = Array.from(monthSet).sort();

    // Determine the active month
    let activeMonth;
    if (state.budgetMonth && state.budgetMonths.includes(state.budgetMonth)) {
        activeMonth = state.budgetMonth;
    } else if (state.budgetMonths.length > 0) {
        activeMonth = state.budgetMonths[state.budgetMonths.length - 1];
        state.budgetMonth = activeMonth;
    } else {
        const now = new Date();
        activeMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        state.budgetMonth = activeMonth;
    }

    // ── Render the month slider ───────────────────────────────────────────
    renderBudgetMonthSlider(activeMonth);

    // ── Sum expenses per tracked category for the active month ────────────
    const spent = {};
    Object.keys(BUDGET_LIMITS).forEach(cat => spent[cat] = 0);

    for (let i = 0; i < state.viewTransactions.length; i++) {
        const txn = state.viewTransactions[i];
        if (txn.type !== 'expense') continue;
        if (!txn.date.startsWith(activeMonth)) continue;
        if (spent.hasOwnProperty(txn.category)) {
            spent[txn.category] += txn.amount;
        }
    }

    // Category colour map for dots
    const dotColors = {
        'Food & Dining': 'var(--color-cat-food)',
        'Housing': 'var(--color-cat-housing)',
        'Transport': 'var(--color-cat-transport)',
        'Entertainment': 'var(--color-cat-entertainment)',
        'Utilities': '#3B82F6',
        'Healthcare': '#EC4899',
        'Subscriptions': '#8B5CF6',
        'Education': '#F59E0B',
        'Others': '#6B7280'
    };

    let hasOverrun = false;

    // Clear and rebuild
    container.innerHTML = '';

    const categories = Object.keys(BUDGET_LIMITS);
    for (let c = 0; c < categories.length; c++) {
        const categoryName = categories[c];
        const limit = getBudgetLimit(categoryName);
        const actualSpent = spent[categoryName] || 0;

        const rawPercent = limit > 0 ? (actualSpent / limit) * 100 : 0;
        const clampedPercent = Math.min(rawPercent, 100);
        const displayPercent = rawPercent.toFixed(0);
        const isOverrun = rawPercent >= 100;
        if (isOverrun) hasOverrun = true;

        const dotColor = dotColors[categoryName] || 'var(--color-accent)';

        const article = document.createElement('article');
        article.className = 'budget-item' + (isOverrun ? ' budget-item--overrun' : '');
        article.setAttribute('aria-label', categoryName + ' budget');

        article.innerHTML = `
          <div class="budget-item__meta">
            <div class="budget-item__label-group">
              <span class="budget-item__dot" style="background-color: ${dotColor}" aria-hidden="true"></span>
              <span class="budget-item__name">${escapeHTML(categoryName)}</span>
            </div>
            <div class="budget-item__amounts">
              <span class="budget-item__spent">${formatCurrency(actualSpent)}</span>
              <span class="budget-item__separator">/</span>
              <span class="budget-item__limit budget-item__limit--editable"
                    data-category="${escapeHTML(categoryName)}"
                    title="Click to edit budget">${formatCurrency(limit)}</span>
            </div>
          </div>
          <div class="budget-item__bar-row">
            <div class="progress-bar" role="progressbar" aria-valuenow="${Math.round(rawPercent)}"
                 aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHTML(categoryName)} budget usage">
              <div class="progress-fill${isOverrun ? ' progress-fill--overrun' : ''}" style="width: ${clampedPercent}%"></div>
            </div>
            <span class="budget-item__percent">${displayPercent}%</span>
          </div>
        `;
        container.appendChild(article);
    }

    // Attach click-to-edit handlers on all limit labels
    const limitLabels = container.querySelectorAll('.budget-item__limit--editable');
    for (let i = 0; i < limitLabels.length; i++) {
        limitLabels[i].addEventListener('click', handleBudgetLimitClick);
    }

    // ── Overrun warning banner ────────────────────────────────────────────
    const warningEl = document.getElementById('budget-overrun-warning');
    if (warningEl) {
        if (hasOverrun) {
            warningEl.removeAttribute('hidden');
        } else {
            warningEl.setAttribute('hidden', '');
        }
    }
}

/**
 * Renders the month slider UI — label, dots, and button states.
 * Called from within renderBudgetTracker().
 * @param {string} activeMonth — The currently active YYYY-MM string
 */
function renderBudgetMonthSlider(activeMonth) {
    const labelEl = document.getElementById('budget-month-label');
    const dotsEl = document.getElementById('budget-month-dots');
    const prevBtn = document.getElementById('btn-budget-month-prev');
    const nextBtn = document.getElementById('btn-budget-month-next');

    if (!labelEl || !dotsEl) return;

    // Format active month as "Month YYYY"
    const [year, month] = activeMonth.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(month, 10) - 1] || month;
    labelEl.textContent = monthName + ' ' + year;

    // Update button disabled states
    const idx = state.budgetMonths.indexOf(activeMonth);
    if (prevBtn) prevBtn.disabled = (idx <= 0);
    if (nextBtn) nextBtn.disabled = (idx >= state.budgetMonths.length - 1);

    // Render dots
    dotsEl.innerHTML = '';
    for (let i = 0; i < state.budgetMonths.length; i++) {
        const dot = document.createElement('span');
        dot.className = 'month-slider__dot' + (state.budgetMonths[i] === activeMonth ? ' month-slider__dot--active' : '');
        dot.dataset.month = state.budgetMonths[i];
        dot.title = state.budgetMonths[i];
        dot.addEventListener('click', function () {
            state.budgetMonth = this.dataset.month;
            renderBudgetTracker();
            renderAnalytics();
        });
        dotsEl.appendChild(dot);
    }
}

/**
 * Handles click on a budget limit label — replaces it with an inline
 * number input so the user can type a new budget amount.
 */
function handleBudgetLimitClick(event) {
    const limitSpan = event.currentTarget;
    const categoryName = limitSpan.dataset.category;
    const currentLimit = getBudgetLimit(categoryName);

    // Prevent double-clicking from creating multiple inputs
    if (limitSpan.querySelector('input')) return;

    // Create inline input
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'budget-limit-input';
    input.value = currentLimit;
    input.min = '0';
    input.step = '500';
    input.setAttribute('aria-label', 'Set budget for ' + categoryName);

    // Replace the text with the input
    limitSpan.textContent = '';
    limitSpan.appendChild(input);
    input.focus();
    input.select();

    // Save on blur or Enter
    function saveLimit() {
        const newVal = parseFloat(input.value);
        if (!isNaN(newVal) && newVal >= 0) {
            state.userBudgets[categoryName] = newVal;
            saveBudgetsToStorage();
        }
        // Re-render the whole budget tracker to reflect the change
        renderBudgetTracker();
        // Also re-render analytics (budget vs actual chart)
        renderAnalytics();
    }

    input.addEventListener('blur', saveLimit);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur(); // triggers saveLimit via blur handler
        }
        if (e.key === 'Escape') {
            // Cancel editing — just re-render without saving
            renderBudgetTracker();
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7d — Render Analytics (Charts & Statistics)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregates data and initializes Apache ECharts visualizations.
 * Features gradient fills, glassmorphic tooltips, and smooth animations.
 */
function renderAnalytics() {
    const expenses = state.viewTransactions.filter(t => t.type === 'expense');

    // ── 0. Check for empty state ──────────────────────────────────────────
    if (expenses.length === 0) {
        console.info('[FinSight] No expense data available for charts.');
        return;
    }

    // Ensure ECharts is loaded
    if (typeof echarts === 'undefined') {
        console.error('[FinSight] ECharts library not found. Check network/CDN.');
        return;
    }

    // ── 1. DATA AGGREGATION ───────────────────────────────────────────────

    // Category Distribution (for Pie Chart)
    const categoryMap = expenses.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
    }, {});

    // Monthly Spending Trend (for Line Chart)
    const monthMap = {};
    const incomeMonthMap = {};
    for (let i = 0; i < state.viewTransactions.length; i++) {
        const t = state.viewTransactions[i];
        const month = t.date.substring(0, 7);
        if (t.type === 'expense') {
            monthMap[month] = (monthMap[month] || 0) + t.amount;
        } else {
            incomeMonthMap[month] = (incomeMonthMap[month] || 0) + t.amount;
        }
    }
    const allMonths = [...new Set([...Object.keys(monthMap), ...Object.keys(incomeMonthMap)])].sort();

    // ── 2. SHARED STYLING ─────────────────────────────────────────────────

    const palette = ['#00E5E5', '#F59E0B', '#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#FF6B6B', '#06D6A0'];
    const tooltipStyle = {
        backgroundColor: 'rgba(10, 26, 60, 0.92)',
        borderColor: 'rgba(0, 229, 229, 0.3)',
        borderWidth: 1,
        textStyle: {
            color: '#F5F5F5',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13
        },
        extraCssText: 'backdrop-filter: blur(12px); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);'
    };

    // Helper: safely init or get existing ECharts instance
    function getChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;
        let instance = echarts.getInstanceByDom(container);
        if (instance) {
            instance.dispose();
        }
        return echarts.init(container, null, { renderer: 'canvas' });
    }

    // ── A. SPENDING TREND (Area + Bar Chart) ──────────────────────────────

    const trendChart = getChart('spending-trend-chart');
    if (trendChart) {
        trendChart.setOption({
            tooltip: {
                ...tooltipStyle,
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    crossStyle: { color: 'rgba(0, 229, 229, 0.3)' }
                }
            },
            legend: {
                data: ['Income', 'Expenses'],
                textStyle: { color: '#8892A6', fontFamily: 'Inter' },
                top: 0,
                icon: 'roundRect',
                itemWidth: 14,
                itemHeight: 8,
                itemGap: 20
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: 40,
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: allMonths,
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
                axisLabel: { color: '#8892A6', fontFamily: 'Inter', fontSize: 11 },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'value',
                axisLine: { show: false },
                axisLabel: {
                    color: '#8892A6',
                    fontFamily: 'Inter',
                    fontSize: 11,
                    formatter: function (v) { return '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v); }
                },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }
            },
            series: [
                {
                    name: 'Income',
                    type: 'bar',
                    data: allMonths.map(m => incomeMonthMap[m] || 0),
                    barWidth: '30%',
                    itemStyle: {
                        borderRadius: [6, 6, 0, 0],
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(0, 229, 229, 0.8)' },
                            { offset: 1, color: 'rgba(0, 229, 229, 0.15)' }
                        ])
                    }
                },
                {
                    name: 'Expenses',
                    type: 'line',
                    data: allMonths.map(m => monthMap[m] || 0),
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: { color: '#EC4899', width: 3, shadowColor: 'rgba(236, 72, 153, 0.4)', shadowBlur: 10 },
                    itemStyle: { color: '#EC4899', borderColor: '#0A1A3C', borderWidth: 2 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(236, 72, 153, 0.25)' },
                            { offset: 1, color: 'rgba(236, 72, 153, 0)' }
                        ])
                    }
                }
            ],
            animationDuration: 1200,
            animationEasing: 'cubicOut'
        });

        // Make responsive on window resize
        window.addEventListener('resize', function () { trendChart.resize(); });
    }

    // ── B. CATEGORY BREAKDOWN (Rose-type Pie Chart) ───────────────────────

    const catLabels = Object.keys(categoryMap);
    const pieData = catLabels.map((cat, i) => ({
        name: cat,
        value: categoryMap[cat],
        itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                { offset: 0, color: palette[i % palette.length] },
                { offset: 1, color: palette[(i + 1) % palette.length] }
            ])
        }
    }));

    const pieChart = getChart('category-breakdown-chart');
    if (pieChart) {
        pieChart.setOption({
            tooltip: {
                ...tooltipStyle,
                trigger: 'item',
                formatter: function (params) {
                    return '<strong>' + params.name + '</strong><br/>₹' +
                        params.value.toLocaleString('en-IN') + ' (' + params.percent + '%)';
                }
            },
            legend: {
                orient: 'vertical',
                right: 10,
                top: 'center',
                textStyle: { color: '#8892A6', fontFamily: 'Inter', fontSize: 11 },
                icon: 'circle',
                itemWidth: 10,
                itemHeight: 10,
                itemGap: 12
            },
            series: [{
                type: 'pie',
                radius: ['40%', '75%'],
                center: ['40%', '50%'],
                roseType: 'area',
                data: pieData,
                label: {
                    show: false
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: 'Inter',
                        color: '#F5F5F5'
                    },
                    itemStyle: {
                        shadowBlur: 20,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
                itemStyle: {
                    borderRadius: 8,
                    borderColor: '#0A1A3C',
                    borderWidth: 3
                },
                animationType: 'scale',
                animationEasing: 'elasticOut',
                animationDuration: 1500
            }]
        });

        window.addEventListener('resize', function () { pieChart.resize(); });
    }

    // ── C. BUDGET VS ACTUAL (Horizontal Bar with Markers) ─────────────────

    // Use the same month as the budget tracker slider
    let chartActiveMonth = state.budgetMonth || '';
    if (!chartActiveMonth) {
        for (let i = 0; i < expenses.length; i++) {
            const m = expenses[i].date.substring(0, 7);
            if (m > chartActiveMonth) chartActiveMonth = m;
        }
    }
    if (!chartActiveMonth) {
        const now = new Date();
        chartActiveMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }
    const budgetCategories = Object.keys(BUDGET_LIMITS);

    const currentMonthActuals = budgetCategories.map(cat => {
        return expenses
            .filter(t => t.category === cat && t.date.startsWith(chartActiveMonth))
            .reduce((sum, t) => sum + t.amount, 0);
    });

    const budgetLimits = budgetCategories.map(cat => getBudgetLimit(cat));

    const budgetChart = getChart('budget-vs-actual-chart');
    if (budgetChart) {
        budgetChart.setOption({
            tooltip: {
                ...tooltipStyle,
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params) {
                    let html = '<strong>' + params[0].name + '</strong><br/>';
                    for (let i = 0; i < params.length; i++) {
                        const p = params[i];
                        html += '<span style="display:inline-block;margin-right:5px;border-radius:50%;width:8px;height:8px;background:' + p.color + '"></span>';
                        html += p.seriesName + ': ₹' + p.value.toLocaleString('en-IN') + '<br/>';
                    }
                    return html;
                }
            },
            legend: {
                data: ['Budget Limit', 'Actual Spent'],
                textStyle: { color: '#8892A6', fontFamily: 'Inter' },
                top: 0,
                icon: 'roundRect',
                itemWidth: 14,
                itemHeight: 8
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: 40,
                containLabel: true
            },
            xAxis: {
                type: 'value',
                axisLine: { show: false },
                axisLabel: {
                    color: '#8892A6',
                    fontFamily: 'Inter',
                    fontSize: 11,
                    formatter: function (v) { return '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v); }
                },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } }
            },
            yAxis: {
                type: 'category',
                data: budgetCategories.map(c => c.length > 12 ? c.substring(0, 11) + '…' : c),
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
                axisLabel: { color: '#8892A6', fontFamily: 'Inter', fontSize: 11 },
                axisTick: { show: false }
            },
            series: [
                {
                    name: 'Budget Limit',
                    type: 'bar',
                    data: budgetLimits,
                    barWidth: '35%',
                    barGap: '10%',
                    itemStyle: {
                        borderRadius: [0, 4, 4, 0],
                        color: 'rgba(245, 245, 245, 0.08)',
                        borderColor: 'rgba(245, 245, 245, 0.15)',
                        borderWidth: 1
                    }
                },
                {
                    name: 'Actual Spent',
                    type: 'bar',
                    data: currentMonthActuals,
                    barWidth: '35%',
                    itemStyle: {
                        borderRadius: [0, 6, 6, 0],
                        color: function (params) {
                            const limit = budgetLimits[params.dataIndex];
                            const spent = params.value;
                            if (spent >= limit) {
                                return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                                    { offset: 0, color: '#FF6B6B' },
                                    { offset: 1, color: '#FF0028' }
                                ]);
                            }
                            return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                                { offset: 0, color: 'rgba(0, 229, 229, 0.6)' },
                                { offset: 1, color: '#00E5E5' }
                            ]);
                        }
                    }
                }
            ],
            animationDuration: 1000,
            animationEasing: 'cubicOut'
        });

        window.addEventListener('resize', function () { budgetChart.resize(); });
    }
}


/* ───────────────────────────────────────────────────────────────────────────
   MODULE 8 — EVENT LISTENERS & APP STARTUP
   ───────────────────────────────────────────────────────────────────────────
   All user interaction is wired here. Each listener is a named function
   so they can be referenced in error traces and removed if needed.
   The final block at the bottom is the app entry point.
   ─────────────────────────────────────────────────────────────────────────── */

// ─────────────────────────────────────────────────────────────────────────────
// 8a — Form: Manual Transaction Entry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles submission of the #transaction-form.
 * Reads field values, builds a Transaction, updates state, persists, and renders.
 *
 * @param {SubmitEvent} event
 */
async function handleFormSubmit(event) {
    // Prevent the browser's default form submission behaviour (page reload).
    event.preventDefault();

    const form = event.target;
    const messagesEl = document.getElementById('form-messages');

    // ── Read field values ──────────────────────────────────────────────────
    const date = form.querySelector('#txn-date').value;
    const description = form.querySelector('#txn-description').value.trim();
    const amount = form.querySelector('#txn-amount').value;
    const type = form.querySelector('#txn-type').value;
    const category = form.querySelector('#txn-category').value;

    // ── Basic validation ───────────────────────────────────────────────────
    // The form has 'required' attributes which handle empty-field checks in
    // modern browsers. This JS validation is a programmatic backstop.
    if (!date || !description || !amount || !type) {
        if (messagesEl) {
            messagesEl.textContent = 'Please fill in all required fields.';
        }
        return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        if (messagesEl) {
            messagesEl.textContent = 'Amount must be a positive number.';
        }
        return;
    }

    // Clear any prior error messages on successful validation.
    if (messagesEl) {
        messagesEl.textContent = '';
    }

    // ── Build transaction ──────────────────────────────────────────────────
    // We pass 'category' from the dropdown. buildTransaction() will use
    // autoClassify() only if category is empty (the 'Select category' placeholder).
    const transaction = buildTransaction(date, description, numericAmount, type, category);

    // ── Mutate state → persist → render ───────────────────────────────────
    const inserted = await addTransaction(transaction);
    if (inserted) {
        const insertedItem = Array.isArray(inserted) ? inserted[0] : inserted;
        state.transactions.push(insertedItem);
    }

    state.currentPage = 0;  // jump back to page 1 so the new row is visible
    renderAll();

    // ── Check if this transaction exceeded the budget ─────────────────────
    if (transaction.type === 'expense') {
        const cat = transaction.category;
        const limit = getBudgetLimit(cat);
        if (limit > 0) {
            const month = transaction.date.substring(0, 7);
            const spent = state.transactions
                .filter(t => t.type === 'expense' && t.category === cat && t.date.startsWith(month))
                .reduce((sum, t) => sum + t.amount, 0);

            if (spent > limit) {
                showBudgetExceededPopup(cat, limit, spent);
            }
        }
    }

    // Reset the form to its blank state for the next entry.
    form.reset();
}

/**
 * Shows the budget exceeded modal.
 * @param {string} category 
 * @param {number} limit 
 * @param {number} spent 
 */
function showBudgetExceededPopup(category, limit, spent) {
    const modal = document.getElementById('modal-budget-exceeded');
    const msgEl = document.getElementById('budget-exceeded-msg');
    const okBtn = document.getElementById('btn-budget-exceeded-ok');

    if (modal && msgEl && okBtn) {
        msgEl.innerHTML = `Your recent transaction caused the <strong>${escapeHTML(category)}</strong> category to exceed its monthly limit of <strong>${formatCurrency(limit)}</strong>. Current spending is <strong>${formatCurrency(spent)}</strong>.`;
        modal.removeAttribute('hidden');
        okBtn.onclick = function () {
            modal.setAttribute('hidden', '');
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8b — Transaction Delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles a click on any delete button (✕) in the transaction table.
 * Reads the transaction id from the button's data-id attribute.
 *
 * @param {MouseEvent} event
 */
async function handleDeleteTransaction(event) {
    const button = event.currentTarget;
    const idToDelete = button.dataset.id;

    const success = await deleteTransaction(idToDelete);
    if (success) {
        // Filter the target transaction out of the array locally.
        state.transactions = state.transactions.filter(function (txn) {
            return txn.id !== idToDelete;
        });
        renderAll();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8c — CSV: File Input Change
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles the <input type="file"> change event.
 * Triggered when the user selects a file via the file-picker dialog.
 *
 * @param {Event} event
 */
function handleFileInputChange(event) {
    const file = event.target.files[0];
    if (file) {
        readAndProcessCSV(file);
    }
    // Reset the input value so the same file can be re-uploaded if needed.
    event.target.value = '';
}

// ─────────────────────────────────────────────────────────────────────────────
// 8d — CSV: Drag and Drop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles the 'dragover' event on the drop zone.
 * We must call preventDefault() here to tell the browser we are accepting
 * the drag — without this, the 'drop' event will never fire.
 *
 * @param {DragEvent} event
 */
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drop-zone--active');
}

/**
 * Handles 'dragleave' — removes the active highlight from the drop zone
 * when the user drags the file away without dropping.
 *
 * @param {DragEvent} event
 */
function handleDragLeave(event) {
    event.currentTarget.classList.remove('drop-zone--active');
}

/**
 * Handles the 'drop' event. Extracts the dropped file from event.dataTransfer
 * and feeds it to the CSV processing pipeline.
 *
 * @param {DragEvent} event
 */
function handleDrop(event) {
    // Prevent the browser from navigating to the dropped file.
    event.preventDefault();
    event.currentTarget.classList.remove('drop-zone--active');

    // DataTransfer.files is a FileList. We only process the first file.
    const file = event.dataTransfer.files[0];
    if (file) {
        readAndProcessCSV(file);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8e — Pagination
// ─────────────────────────────────────────────────────────────────────────────

function handlePrevPage() {
    if (state.currentPage > 0) {
        state.currentPage -= 1;
        renderTransactionList();
    }
}

function handleNextPage() {
    const totalPages = Math.ceil(state.viewTransactions.length / ROWS_PER_PAGE);
    if (state.currentPage < totalPages - 1) {
        state.currentPage += 1;
        renderTransactionList();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8f — Settings & Data Management
// ─────────────────────────────────────────────────────────────────────────────

function bindSettingsEvents() {
    const btnResetInit = document.getElementById('btn-reset-data-init');
    const btnResetCancel = document.getElementById('btn-reset-data-cancel');
    const btnResetConfirm = document.getElementById('btn-reset-data-confirm');
    const btnLoadSample = document.getElementById('btn-load-sample');
    const modal = document.getElementById('modal-confirm-reset');

    if (btnResetInit && modal) {
        btnResetInit.addEventListener('click', () => {
            modal.removeAttribute('hidden');
        });
    }

    if (btnResetCancel && modal) {
        btnResetCancel.addEventListener('click', () => {
            modal.setAttribute('hidden', '');
        });
    }

    if (btnResetConfirm) {
        btnResetConfirm.addEventListener('click', async () => {
            // Delete every transaction from the backend via existing endpoint
            const deletePromises = state.transactions.map(txn =>
                deleteTransaction(txn.id)
            );
            await Promise.all(deletePromises);

            // Complete state wipe
            state.transactions = [];
            state.importedFiles = [];
            saveImportedFilesToStorage();
            state.currentPage = 0;
            saveToStorage();
            window.location.reload(); // Hard reload to clear charts and DOM
        });
    }

    if (btnLoadSample) {
        btnLoadSample.addEventListener('click', () => {
            loadSampleIndianData();
        });
    }
}

/**
 * Injects realistic Indian financial data to demonstrate dashboard features.
 */
function loadSampleIndianData() {
    const now = new Date();
    const yearMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    const sampleData = [
        { date: `${yearMonth}-01`, description: 'Monthly Salary', amount: 116667, type: 'income', category: 'Salary' },
        { date: `${yearMonth}-02`, description: 'HDFC Home Loan EMI', amount: 32000, type: 'expense', category: 'Housing' },
        { date: `${yearMonth}-05`, description: 'BigBasket Grocery', amount: 4500, type: 'expense', category: 'Food & Dining' },
        { date: `${yearMonth}-08`, description: 'Uber to Office', amount: 450, type: 'expense', category: 'Transport' },
        { date: `${yearMonth}-10`, description: 'Reliance Digital - Laptop', amount: 75000, type: 'expense', category: 'Entertainment' },
        { date: `${yearMonth}-12`, description: 'Freelance Design Project', amount: 15000, type: 'income', category: 'Freelance' },
        { date: `${yearMonth}-15`, description: 'Swiggy Dinner', amount: 1200, type: 'expense', category: 'Food & Dining' },
        { date: `${yearMonth}-18`, description: 'Zomato Lunch', amount: 350, type: 'expense', category: 'Food & Dining' }
    ];

    state.transactions = sampleData.map((data, index) => {
        // Add index to millisecond timestamp to ensure unique IDs during map loop
        const id = (Date.now() + index).toString();
        const t = buildTransaction(data.date, data.description, data.amount, data.type, data.category);
        t.id = id;
        return t;
    });
    saveToStorage();
    window.location.reload();
}


/* ───────────────────────────────────────────────────────────────────────────
   UTILITY HELPERS
   ───────────────────────────────────────────────────────────────────────────
   Small, reusable helper functions used across multiple modules.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Formats a number as a USD currency string.
 * Example: 1234.5 → "$1,234.50"
 *
 * Uses the built-in Intl.NumberFormat API — no third-party formatting library
 * needed. The 'en-US' locale and 'USD' currency give standard dollar formatting.
 *
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    /**
     * Currency formatter instance. Uses Indian English (en-IN) to ensure
     * comma placement follows the 1,00,000.00 (lakh/crore) convention.
     */
    const currencyFormatter = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    });

    return currencyFormatter.format(amount);
}

/**
 * Sets the textContent of an element by ID.
 * A tiny convenience wrapper to avoid repetitive getElementById + textContent
 * chains throughout the render functions.
 *
 * @param {string} elementId
 * @param {string} text
 */
function setText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = text;
    }
}

/**
 * Escapes HTML special characters in a string to prevent XSS injection.
 * When inserting user-supplied data (descriptions, categories) into innerHTML,
 * always run it through this function first.
 *
 * Characters escaped: & < > " '
 *
 * @param {string} str — Raw string potentially containing HTML characters
 * @returns {string}  — Safe string for insertion via innerHTML
 */
function escapeHTML(str) {
    const text = String(str);
    // We use a <div> element as a safe container. Setting textContent and then
    // reading innerHTML lets the browser do the escaping for us — no regex.
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


/* ───────────────────────────────────────────────────────────────────────────
   APP STARTUP (Entry Point)
   ───────────────────────────────────────────────────────────────────────────
   This block runs once when the page finishes loading (DOMContentLoaded).
   Execution order:
     1. Load persisted data from localStorage into state
     2. Render the initial UI from that state
     3. Attach all event listeners

   WHY DOMContentLoaded (not 'load' or inline script):
     DOMContentLoaded fires when the HTML is fully parsed and all DOM elements
     exist. We need the DOM ready before querying any element IDs. 'load' would
     also wait for images and stylesheets, which is unnecessary here.
     The <script defer> tag in index.html achieves the same effect, so this
     listener is a belt-and-braces safety net.
   ─────────────────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async function () {
    // Landing intro screen
    const landingScreen = document.getElementById('landing-screen');
    const landingStartBtn = document.getElementById('btn-landing-start');
    const sidebarBrand = document.querySelector('.sidebar__logo');
    if (landingScreen) {
        const hideLanding = function () {
            landingScreen.classList.add('landing-screen--hidden');
        };

        const showLanding = function () {
            landingScreen.classList.remove('landing-screen--hidden');
        };

        if (landingStartBtn) {
            landingStartBtn.addEventListener('click', hideLanding);
        }

        if (sidebarBrand) {
            sidebarBrand.addEventListener('click', showLanding);
            sidebarBrand.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showLanding();
                }
            });
        }
    }

    // ── Step 1: Restore persisted data ─────────────────────────────────────
    state.transactions = await getTransactions();
    loadBudgetsFromStorage();
    loadImportedFilesFromStorage();

    // ── Step 2: Render initial UI ──────────────────────────────────────────
    renderAll();

    // ── Step 3: Attach event listeners ────────────────────────────────────

    // Manual transaction form
    const form = document.getElementById('transaction-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // CSV file input (triggered by clicking the drop-zone label)
    const csvFileInput = document.getElementById('csv-file-input');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', handleFileInputChange);
    }

    // Search & Filter on transaction history table
    const txnSearchInput = document.getElementById('txn-search');
    if (txnSearchInput) {
        txnSearchInput.addEventListener('input', function () {
            state.searchQuery = txnSearchInput.value;
            state.currentPage = 0;
            renderAll();
        });
    }

    const filterCategorySelect = document.getElementById('filter-category');
    if (filterCategorySelect) {
        filterCategorySelect.addEventListener('change', function () {
            state.filterCategory = filterCategorySelect.value;
            state.currentPage = 0;
            renderAll();
        });
    }

    // CSV drag-and-drop on the drop zone label
    const dropZone = document.getElementById('csv-drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);
    }

    // Pagination buttons
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    if (prevBtn) prevBtn.addEventListener('click', handlePrevPage);
    if (nextBtn) nextBtn.addEventListener('click', handleNextPage);

    // Budget month slider buttons
    const budgetPrev = document.getElementById('btn-budget-month-prev');
    const budgetNext = document.getElementById('btn-budget-month-next');
    if (budgetPrev) {
        budgetPrev.addEventListener('click', function () {
            const idx = state.budgetMonths.indexOf(state.budgetMonth);
            if (idx > 0) {
                state.budgetMonth = state.budgetMonths[idx - 1];
                renderBudgetTracker();
                renderAnalytics();
            }
        });
    }
    if (budgetNext) {
        budgetNext.addEventListener('click', function () {
            const idx = state.budgetMonths.indexOf(state.budgetMonth);
            if (idx < state.budgetMonths.length - 1) {
                state.budgetMonth = state.budgetMonths[idx + 1];
                renderBudgetTracker();
                renderAnalytics();
            }
        });
    }

    // Monthly Overview year selector
    const overviewYearSelect = document.getElementById('overview-year-select');
    if (overviewYearSelect) {
        overviewYearSelect.addEventListener('change', function () {
            renderMonthlyOverview();
        });
    }

    // Settings & Data Management
    bindSettingsEvents();

    // Imported files list controls
    const btnClearImportedFiles = document.getElementById('btn-clear-imported-files');
    if (btnClearImportedFiles) {
        btnClearImportedFiles.addEventListener('click', function () {
            state.importedFiles = [];
            saveImportedFilesToStorage();
            renderImportedFilesPanel();
        });
    }

    // Date Filtering (year/month/day) — checkbox dropdowns
    const filterRoot = document.getElementById('transaction-history');

    function getCheckedValues(filterType) {
        if (!filterRoot) return [];
        return Array.from(filterRoot.querySelectorAll(`input[type="checkbox"][data-filter="${filterType}"]:checked`))
            .map(el => el.value);
    }

    function updateFilterButtonLabels() {
        const monthLabel = (m) => {
            const n = Number(m);
            const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            if (Number.isFinite(n) && n >= 1 && n <= 12) return labels[n - 1];
            return String(m);
        };

        const summarize = (vals, { map = (x) => x, maxShown = 3 } = {}) => {
            const safe = Array.isArray(vals) ? vals.slice() : [];
            const mapped = safe.map(map).filter(Boolean);
            if (mapped.length === 0) return '';
            if (mapped.length <= maxShown) return mapped.join(', ');
            const shown = mapped.slice(0, maxShown).join(', ');
            return `${shown} +${mapped.length - maxShown}`;
        };

        const setLabel = (rootId, base, values, options) => {
            const root = document.getElementById(rootId);
            if (!root) return;
            const btn = root.querySelector('.multi-filter__btn');
            if (!btn) return;
            const details = summarize(values, options);
            btn.firstChild.textContent = details ? `${base} (${details})` : base;
        };
        setLabel('filter-year', 'Year', state.dateFilter.years || [], { map: (v) => String(v), maxShown: 2 });
        setLabel('filter-month', 'Month', state.dateFilter.months || [], { map: monthLabel, maxShown: 2 });
        setLabel('filter-day', 'Day', state.dateFilter.days || [], { map: (v) => String(v), maxShown: 3 });
    }

    function applyDateFilterFromUI() {
        state.dateFilter.years = getCheckedValues('year');
        state.dateFilter.months = getCheckedValues('month');
        state.dateFilter.days = getCheckedValues('day');
        state.currentPage = 0;
        updateFilterButtonLabels();
        renderAll();
    }

    // Open/close dropdown menus
    function toggleMenu(buttonEl) {
        const targetId = buttonEl.getAttribute('data-target');
        if (!targetId) return;
        const menu = document.getElementById(targetId);
        if (!menu) return;
        const isOpen = !menu.hasAttribute('hidden');
        if (isOpen) {
            menu.setAttribute('hidden', '');
            buttonEl.setAttribute('aria-expanded', 'false');
        } else {
            menu.removeAttribute('hidden');
            buttonEl.setAttribute('aria-expanded', 'true');
        }
    }

    // Attach listeners
    if (filterRoot) {
        // Toggle dropdown on button click
        const btns = filterRoot.querySelectorAll('.multi-filter__btn');
        btns.forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                toggleMenu(btn);
            });
        });

        // Apply on any checkbox change
        filterRoot.addEventListener('change', function (e) {
            const t = e.target;
            if (t && t.matches && t.matches('input[type="checkbox"][data-filter]')) {
                applyDateFilterFromUI();
            }
        });

        // Close menus when clicking outside
        document.addEventListener('click', function (e) {
            const target = e.target;
            if (target && target.closest && target.closest('.multi-filter')) return;
            const menus = filterRoot.querySelectorAll('.multi-filter__menu:not([hidden])');
            menus.forEach(menu => menu.setAttribute('hidden', ''));
            const openBtns = filterRoot.querySelectorAll('.multi-filter__btn[aria-expanded="true"]');
            openBtns.forEach(b => b.setAttribute('aria-expanded', 'false'));
        });
    }

    // Initial label sync
    updateFilterButtonLabels();

    console.log('FinSight Analytics initialised. Transactions loaded:', state.transactions.length);
});
