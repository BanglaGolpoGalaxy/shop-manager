// ========== REQUIRE PACKAGES ==========
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const fs = require('fs');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'my_shop_secret_key_2026';
const dbPath = path.join(__dirname, 'shop.db');

let db;

// ========== MIDDLEWARE ==========
app.use(express.static('public'));
app.use(express.json());

// ========== DATABASE INITIALIZATION ==========
async function initDatabase() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('📂 Database loaded');
  } else {
    db = new SQL.Database();
    createTables();
    insertSampleData();
  }
  console.log('✅ Database ready');
}

function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT DEFAULT '', variant TEXT DEFAULT '', price REAL NOT NULL, stock INTEGER DEFAULT 0, unit TEXT DEFAULT '')`);
  db.run(`CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, subtotal REAL DEFAULT 0, discount REAL DEFAULT 0, total REAL DEFAULT 0, due_amount REAL DEFAULT 0, pay_mode TEXT DEFAULT 'Cash', customer_name TEXT DEFAULT '', customer_mobile TEXT DEFAULT '')`);
  db.run(`CREATE TABLE IF NOT EXISTS sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER, product_id INTEGER, product_name TEXT, variant TEXT, price REAL, qty INTEGER, subtotal REAL)`);
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'admin')`);
}

function insertSampleData() {
  db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', 'admin123', 'admin']);
  const count = db.exec('SELECT COUNT(*) FROM products')[0].values[0][0];
  if (count === 0) {
    const products = [
      ['Rice (Coarse)', 'Grain', '1 kg', 55, 100, 'kg'],
      ['Red Lentils', 'Pulse', '1 kg', 120, 40, 'kg'],
      ['Soybean Oil', 'Oil', '1L Bottle', 175, 25, 'bottle'],
      ['Soybean Oil', 'Oil', '5L Jar', 800, 10, 'jar'],
      ['Mustard Oil', 'Oil', '1L Bottle', 190, 15, 'bottle'],
      ['Sugar', 'Grocery', '1 kg', 90, 60, 'kg'],
      ['Salt (Packet)', 'Grocery', '1 kg', 25, 150, 'pack'],
      ['Flour', 'Grain', '2 kg', 85, 30, 'pack'],
      ['Soap (Lux)', 'Toiletry', '75g', 35, 80, 'pcs'],
      ['Soap (Lux)', 'Toiletry', '150g', 60, 50, 'pcs'],
      ['Soap (Lifebuoy)', 'Toiletry', '125g', 40, 60, 'pcs'],
      ['Tea Leaves', 'Beverage', '250g', 95, 20, 'pack']
    ];
    for (const p of products) {
      db.run('INSERT INTO products (name, category, variant, price, stock, unit) VALUES (?, ?, ?, ?, ?, ?)', p);
    }
  }
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// ========== AUTH MIDDLEWARE ==========
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ========== PRODUCT ROUTES ==========
app.get('/products', (req, res) => {
  const results = db.exec('SELECT * FROM products ORDER BY id');
  if (!results.length) return res.json([]);
  const cols = results[0].columns;
  res.json(results[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = row[i]; });
    return obj;
  }));
});

app.post('/products', authMiddleware, (req, res) => {
  const { name, category, variant, price, stock, unit } = req.body;
  if (!name || !price) return res.status(400).json({ message: 'Name and price are required' });
  db.run('INSERT INTO products (name, category, variant, price, stock, unit) VALUES (?, ?, ?, ?, ?, ?)', [name, category || '', variant || '', price, stock || 0, unit || '']);
  saveDatabase();
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  res.status(201).json({ message: 'Product added', product: { id, name, category, variant, price, stock, unit } });
});

app.put('/products/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.exec('SELECT * FROM products WHERE id = ?', [id]);
  if (!existing.length || !existing[0].values.length) return res.status(404).json({ message: 'Product not found' });
  const p = existing[0].values[0];
  const u = req.body;
  db.run('UPDATE products SET name=?, category=?, variant=?, price=?, stock=?, unit=? WHERE id=?', [
    u.name !== undefined ? u.name : p[1],
    u.category !== undefined ? u.category : p[2],
    u.variant !== undefined ? u.variant : p[3],
    u.price !== undefined ? u.price : p[4],
    u.stock !== undefined ? u.stock : p[5],
    u.unit !== undefined ? u.unit : p[6],
    id
  ]);
  saveDatabase();
  res.json({ message: 'Product updated' });
});

app.delete('/products/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  db.run('DELETE FROM products WHERE id = ?', [id]);
  saveDatabase();
  res.json({ message: 'Product deleted' });
});

// ========== SALES ROUTES ==========
app.post('/sales', authMiddleware, (req, res) => {
  const { items, discount = 0, payMode = 'Cash', customer = {}, paidAmount = 0 } = req.body;
  if (!items || !items.length) return res.status(400).json({ message: 'No items provided' });
  let subtotal = 0;
  for (let item of items) {
    const product = db.exec('SELECT * FROM products WHERE id = ?', [item.id]);
    if (!product.length || !product[0].values.length) return res.status(404).json({ message: `Product id ${item.id} not found` });
    const p = product[0].values[0];
    if (p[5] < item.qty) return res.status(400).json({ message: `Not enough stock for ${p[1]}` });
    subtotal += p[4] * item.qty;
  }
  const total = Math.max(0, subtotal - discount);
  const dueAmount = Math.max(0, total - (paidAmount || 0));
  const date = new Date().toISOString();
  db.run('INSERT INTO sales (date, subtotal, discount, total, due_amount, pay_mode, customer_name, customer_mobile) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [date, subtotal, discount, total, dueAmount, payMode, customer.name || '', customer.mobile || '']);
  const saleId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  for (let item of items) {
    const product = db.exec('SELECT * FROM products WHERE id = ?', [item.id])[0].values[0];
    db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, item.id]);
    db.run('INSERT INTO sale_items (sale_id, product_id, product_name, variant, price, qty, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)', [saleId, product[0], product[1], product[3] || '', product[4], item.qty, product[4] * item.qty]);
  }
  saveDatabase();
  res.status(201).json({ message: 'Sale completed', sale: { id: saleId, date, subtotal, discount, total, due_amount: dueAmount, pay_mode: payMode, customer } });
});

// GET /sales
app.get('/sales', authMiddleware, (req, res) => {
  const sales = db.exec('SELECT * FROM sales ORDER BY id DESC');
  if (!sales.length) return res.json([]);
  const cols = sales[0].columns;
  const result = sales[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = row[i]; });
    const items = db.exec('SELECT COUNT(*) as count FROM sale_items WHERE sale_id = ?', [obj.id]);
    obj.item_count = items.length && items[0].values.length ? items[0].values[0][0] : 0;
    return obj;
  });
  res.json(result);
});

// GET /sales/:date
app.get('/sales/:date', authMiddleware, (req, res) => {
  const date = req.params.date;
  const sales = db.exec('SELECT * FROM sales WHERE date LIKE ? ORDER BY id DESC', [`${date}%`]);
  if (!sales.length) return res.json([]);
  const cols = sales[0].columns;
  const result = sales[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = row[i]; });
    const items = db.exec('SELECT COUNT(*) as count FROM sale_items WHERE sale_id = ?', [obj.id]);
    obj.item_count = items.length && items[0].values.length ? items[0].values[0][0] : 0;
    return obj;
  });
  res.json(result);
});

// ========== LOGIN ROUTE ==========
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.exec('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  if (!user.length || !user[0].values.length) return res.status(401).json({ message: 'Invalid username or password' });
  const u = user[0].values[0];
  const token = jwt.sign({ id: u[0], username: u[1], role: u[4] }, SECRET_KEY, { expiresIn: '24h' });
  res.json({ message: 'Login successful', token });
});

// ========== START SERVER ==========
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
});
