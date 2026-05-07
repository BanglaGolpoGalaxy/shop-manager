// ========== DATABASE SETUP (sql.js version) ==========
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'shop.db');

async function setupDatabase() {
  const SQL = await initSqlJs();
  let db;

  // Load existing database or create new
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('📂 Existing database loaded');
  } else {
    db = new SQL.Database();
    console.log('🆕 New database created');
  }

  // ========== CREATE TABLES ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      variant TEXT DEFAULT '',
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      unit TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      pay_mode TEXT DEFAULT 'Cash',
      customer_name TEXT DEFAULT '',
      customer_mobile TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      variant TEXT DEFAULT '',
      price REAL NOT NULL,
      qty INTEGER NOT NULL,
      subtotal REAL NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin'
    )
  `);

  // Insert default admin user if not exists
  const userResult = db.exec('SELECT id FROM users WHERE username = \'admin\'');
  if (!userResult.length || !userResult[0].values.length) {
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', 'admin123', 'admin']);
    console.log('✅ Default admin user created');
  }

  // Insert sample products if table is empty
  const countResult = db.exec('SELECT COUNT(*) as count FROM products');
  const count = countResult[0].values[0][0];
  
  if (count === 0) {
    const sampleProducts = [
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

    for (const p of sampleProducts) {
      db.run('INSERT INTO products (name, category, variant, price, stock, unit) VALUES (?, ?, ?, ?, ?, ?)', p);
    }
    console.log('✅ Sample products inserted');
  }

  // Save database to file
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
  console.log('💾 Database saved to shop.db');

  return db;
}

// Helper to save database
function saveDatabase(db) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

module.exports = { setupDatabase, saveDatabase };
setupDatabase();
