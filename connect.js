const express = require('express');
const mysql = require('mysql');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
require('dotenv').config(); // 👈 Load .env variables

const app = express();
const port = 3000;

// MySQL Connection via .env (Clever Cloud)
const db = mysql.createConnection({
    host: "bpiq9wp3873wyibgxtcp-mysql.services.clever-cloud.com",
    user: "urph6ydqlay2wokw",
    password: "cgSqmyMygUTcPwZycJOH",
    database: "bpiq9wp3873wyibgxtcp",
    port: 3306,
    ssl: { rejectUnauthorized: false }, // SSL support (Clever Cloud requirement)
  });
db.connect((err) => {
    if (err) {
        console.error('MySQL connection error:', err);
        return;
    }
    console.log('✅ Connected to Clever Cloud MySQL');
});

// Multer Setup for Image Upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
            return cb(new Error('Only PNG, JPG, or JPEG files are allowed'));
        }
        cb(null, Date.now() + ext);
    }
});

const upload = multer({ storage: storage });

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({ secret: 'shopping-cart-secret', resave: false, saveUninitialized: true }));

// Route for adding product
app.post('/add-product', upload.single('image'), (req, res) => {
    const { name, price, description, quantity } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '';
    const query = 'INSERT INTO products (name, price, description, quantity, image) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [name, price, description, quantity, image], (err, result) => {
        if (err) return res.status(500).send('Error adding product');
        res.redirect('/product.html');
    });
});

// Route to fetch all products
app.get('/product-list', (req, res) => {
    const query = 'SELECT * FROM products';
    db.query(query, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Route to add product to cart
app.post('/add-to-cart', (req, res) => {
    const { id, quantity } = req.body;
    const sessionId = req.session.id;

    const query = 'SELECT * FROM cart WHERE product_id = ? AND user_session_id = ?';
    db.query(query, [id, sessionId], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            const newQuantity = results[0].quantity + parseInt(quantity);
            db.query('UPDATE cart SET quantity = ? WHERE product_id = ? AND user_session_id = ?', [newQuantity, id, sessionId], (err) => {
                if (err) throw err;
                res.json({ success: true });
            });
        } else {
            db.query('INSERT INTO cart (product_id, user_session_id, quantity) VALUES (?, ?, ?)', [id, sessionId, quantity], (err) => {
                if (err) throw err;
                res.json({ success: true });
            });
        }
    });
});

// Route to view cart
app.get('/cart', (req, res) => {
    const sessionId = req.session.id;
    const query = 'SELECT c.*, p.name, p.price, p.image FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_session_id = ?';
    db.query(query, [sessionId], (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Route to update cart quantity
app.post('/update-cart', (req, res) => {
    const { id, quantity } = req.body;
    const sessionId = req.session.id;

    const query = 'UPDATE cart SET quantity = ? WHERE product_id = ? AND user_session_id = ?';
    db.query(query, [quantity, id, sessionId], (err) => {
        if (err) throw err;
        res.json({ success: true });
    });
});

// Route to remove item from cart
app.post('/remove-from-cart', (req, res) => {
    const { id } = req.body;
    const sessionId = req.session.id;

    const query = 'DELETE FROM cart WHERE product_id = ? AND user_session_id = ?';
    db.query(query, [id, sessionId], (err) => {
        if (err) throw err;
        res.json({ success: true });
    });
});

// Route to delete a product
app.post('/delete-product', (req, res) => {
    const productId = req.body.id;

    const deleteCartQuery = 'DELETE FROM cart WHERE product_id = ?';
    db.query(deleteCartQuery, [productId], (err) => {
        if (err) {
            console.error('Error deleting cart items:', err);
            return res.status(500).json({ success: false, message: 'Error deleting cart items.' });
        }

        const deleteProductQuery = 'DELETE FROM products WHERE id = ?';
        db.query(deleteProductQuery, [productId], (err) => {
            if (err) {
                console.error('Error deleting product:', err);
                return res.status(500).json({ success: false, message: 'Error deleting product.' });
            }

            res.json({ success: true, message: 'Product deleted successfully.' });
        });
    });
});

// Route to update product with image
app.post('/update-product', upload.single('image'), (req, res) => {
    const { id, name, description, price, quantity } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    if (!id || !name || !description || !price || !quantity) {
        return res.json({ success: false, message: "Missing required fields" });
    }

    let query, values;
    if (image) {
        query = 'UPDATE products SET name=?, description=?, price=?, quantity=?, image=? WHERE id=?';
        values = [name, description, price, quantity, image, id];
    } else {
        query = 'UPDATE products SET name=?, description=?, price=?, quantity=? WHERE id=?';
        values = [name, description, price, quantity, id];
    }

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('DB Error:', err);
            return res.json({ success: false, message: "Database update failed" });
        }

        res.json({ success: true, message: "Product updated successfully" });
    });
});

// Server Setup
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
