// ========== QR CODE GENERATOR (FINAL - AUTO DELETE OLD QR) ==========
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const productsFile = path.join(__dirname, 'products.json');
const qrDir = path.join(__dirname, 'public', 'qrcodes');

if (!fs.existsSync(qrDir)) {
  fs.mkdirSync(qrDir, { recursive: true });
}

// নির্দিষ্ট একটি প্রোডাক্টের QR বানানো
async function generateQRForProduct(product) {
  const qrData = JSON.stringify({
    id: product.id,
    name: product.name,
    variant: product.variant || '',
    price: product.price
  });

  const filePath = path.join(qrDir, `product-${product.id}.png`);
  await QRCode.toFile(filePath, qrData, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });
  console.log(`✅ QR created: product-${product.id}.png (${product.name})`);
}

// সব প্রোডাক্টের QR বানানো (পুরোনো QR অটো-ডিলিট সহ)
async function generateAllQR() {
  // পুরোনো সব QR কোড ডিলিট করা
  if (fs.existsSync(qrDir)) {
    const oldFiles = fs.readdirSync(qrDir);
    for (let file of oldFiles) {
      if (file.startsWith('product-') && file.endsWith('.png')) {
        fs.unlinkSync(path.join(qrDir, file));
      }
    }
    console.log('🗑️ Old QR codes deleted');
  }

  const products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
  for (let product of products) {
    await generateQRForProduct(product);
  }
  console.log('🎉 All QR codes generated!');
}

// নির্দিষ্ট ID-র QR বানানো (নতুন প্রোডাক্টের জন্য)
async function generateQRByID(id) {
  const products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
  const product = products.find(p => p.id === id);
  if (!product) {
    console.log('❌ Product not found');
    return;
  }
  await generateQRForProduct(product);
}

// কমান্ড লাইন থেকে ব্যবহার
const command = process.argv[2];
const param = process.argv[3];

if (command === 'all') {
  generateAllQR();
} else if (command === 'id' && param) {
  generateQRByID(parseInt(param));
} else {
  console.log('Usage:');
  console.log('  node generateQR.js all        - Delete old & generate all QR codes');
  console.log('  node generateQR.js id <ID>    - Generate QR for specific product');
}
