const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

const ADMIN_EMAIL = "admin@aqarak.com";
const ADMIN_PASSWORD = "12345";
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        createTables();
    }
});

const uploadDir = 'public/uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

function createTables() {
    const createPropertiesTableSql = `
        CREATE TABLE IF NOT EXISTS properties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            price TEXT NOT NULL,
            numericPrice REAL, 
            rooms INTEGER,
            bathrooms INTEGER,
            area INTEGER,
            description TEXT,
            imageUrl TEXT,
            imageUrls TEXT,
            type TEXT NOT NULL,
            hiddenCode TEXT
        )
    `;
    db.run(createPropertiesTableSql, (err) => {
        if (err) console.error('Error creating properties table:', err.message);
        else console.log('Properties table OK.');
    });

    const createUsersTableSql = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )
    `;
    db.run(createUsersTableSql, (err) => {
        if (err) console.error('Error creating users table:', err.message);
        else console.log('Users table OK.');
    });
}

// ... (كود /api/register و /api/login زي ما هو مفيش تغيير) ...
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'يرجى ملء جميع الحقول' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const sql = `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`;
        
        db.run(sql, [name, email, hashedPassword, 'user'], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(400).json({ message: 'هذا البريد الإلكتروني مسجل بالفعل' });
                }
                return res.status(500).json({ message: 'خطأ في السيرفر' });
            }
            res.status(201).json({ success: true, message: 'تم إنشاء الحساب بنجاح!' });
        });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في تشفير كلمة المرور' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.json({ success: true, role: 'admin' });
    }

    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'خطأ في السيرفر' });
        }
        if (!user) {
            return res.status(401).json({ message: 'الإيميل أو كلمة المرور غير صحيحة' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            res.json({ success: true, role: user.role });
        } else {
            res.status(401).json({ message: 'الإيميل أو كلمة المرور غير صحيحة' });
        }
    });
});
// ... (كود /api/properties زي ما هو مفيش تغيير) ...
app.get('/api/properties', (req, res) => {
    let sql = "SELECT id, title, price, rooms, bathrooms, area, imageUrl FROM properties";
    const params = [];
    const filters = [];

    const { type, limit, keyword, minPrice, maxPrice, rooms } = req.query;

    if (type) {
        if (type === 'buy') {
            filters.push("type = ?");
            params.push('بيع');
        } else if (type === 'rent') {
            filters.push("type = ?");
            params.push('إيجار');
        }
    }
    
    if (keyword) {
        filters.push("(title LIKE ? OR description LIKE ?)");
        params.push(`%${keyword}%`);
        params.push(`%${keyword}%`);
    }

    if (minPrice) {
        filters.push("numericPrice >= ?");
        params.push(Number(minPrice));
    }

    if (maxPrice) {
        filters.push("numericPrice <= ?");
        params.push(Number(maxPrice));
    }

    if (rooms) {
        if (rooms === '4+') {
            filters.push("rooms >= ?");
            params.push(4);
        } else {
            filters.push("rooms = ?");
            params.push(Number(rooms));
        }
    }

    if (filters.length > 0) {
        sql += " WHERE " + filters.join(" AND ");
    }
    
    sql += " ORDER BY id DESC";

    if (limit) {
        sql += " LIMIT ?";
        params.push(parseInt(limit, 10));
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/property/:id', (req, res) => {
    const sql = "SELECT * FROM properties WHERE id = ?";
    const params = [req.params.id];

    db.get(sql, params, (err, row) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ "message": "Property not found" });
        }
    });
});

app.post('/api/add-property', upload.array('propertyImages', 10), (req, res) => {
    
    const {
        title, price, rooms, bathrooms, area, description,
        type, hiddenCode
    } = req.body;

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'يجب رفع صورة واحدة على الأقل' });
    }
    
    const imageUrls = req.files.map(file => `/uploads/${file.filename}`);
    const mainImageUrl = imageUrls[0];
    const imageUrlsJson = JSON.stringify(imageUrls);

    const numericPrice = parseFloat(price.replace(/,/g, ''));

    if (!title || !price || !type || !hiddenCode) {
        return res.status(400).json({ message: 'خطأ: الحقول الأساسية مطلوبة' });
    }

    const sql = `
        INSERT INTO properties 
        (title, price, numericPrice, rooms, bathrooms, area, description, imageUrl, imageUrls, type, hiddenCode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        title, price, numericPrice, rooms, bathrooms, area, description,
        mainImageUrl, imageUrlsJson, type, hiddenCode
    ];

    db.run(sql, params, function(err) {
        if (err) {
            console.error('Error inserting record:', err.message);
            return res.status(500).json({ message: 'خطأ في السيرفر عند الإضافة' });
        }
        res.status(201).json({ message: 'تم إضافة العقار بنجاح!', id: this.lastID });
    });
});

// --- (الكود الجديد للتعديل) ---
app.put('/api/update-property/:id', upload.array('propertyImages', 10), (req, res) => {
    const propertyId = req.params.id;
    const {
        title, price, rooms, bathrooms, area, description,
        type, hiddenCode, existingImages
    } = req.body;

    let existingImageUrls = JSON.parse(existingImages || '[]');
    const newImageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    
    const allImageUrls = [...existingImageUrls, ...newImageUrls];
    const mainImageUrl = allImageUrls.length > 0 ? allImageUrls[0] : null;
    const imageUrlsJson = JSON.stringify(allImageUrls);
    
    const numericPrice = parseFloat(price.replace(/,/g, ''));

    if (!title || !price || !type || !hiddenCode) {
        return res.status(400).json({ message: 'خطأ: الحقول الأساسية مطلوبة' });
    }

    const sql = `
        UPDATE properties SET
        title = ?, price = ?, numericPrice = ?, rooms = ?, bathrooms = ?, area = ?, 
        description = ?, imageUrl = ?, imageUrls = ?, type = ?, hiddenCode = ?
        WHERE id = ?
    `;
    const params = [
        title, price, numericPrice, rooms, bathrooms, area, description,
        mainImageUrl, imageUrlsJson, type, hiddenCode,
        propertyId
    ];

    db.run(sql, params, function(err) {
        if (err) {
            console.error('Error updating record:', err.message);
            return res.status(500).json({ message: 'خطأ في السيرفر عند التحديث' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'لم يتم العثور على العقار لتحديثه' });
        }
        res.status(200).json({ message: 'تم تحديث العقار بنجاح!' });
    });
});
// --- (نهاية الكود الجديد) ---

app.get('/api/property-by-code/:code', (req, res) => {
    const sql = "SELECT id, title, price, hiddenCode FROM properties WHERE hiddenCode = ?";
    const params = [req.params.code];

    db.get(sql, params, (err, row) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ "message": "Property not found" });
        }
    });
});

app.delete('/api/property/:id', (req, res) => {
    const sql = "DELETE FROM properties WHERE id = ?";
    const params = [req.params.id];

    db.run(sql, params, function(err) {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json({ message: 'Property deleted successfully', changes: this.changes });
    });
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});