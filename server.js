require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const mongoose = require('mongoose');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const app = express(); 

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const PORT = process.env.PORT || 3000;

const ADMIN_EMAIL = "admin@aqarak.com";
const ADMIN_PASSWORD = "12345";
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = process.env.DATABASE_URL; 
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas!'))
    .catch(err => {
        console.error("--- MONGO CONNECTION ERROR ---");
        console.error(err.stack || err.message || JSON.stringify(err));
        console.error("--- ERROR END ---");
    });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'aqarak', 
        format: async (req, file) => 'jpg',
        public_id: (req, file) => Date.now() + '-' + file.originalname,
    },
});

const upload = multer({ storage: storage }); 

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }
});
const User = mongoose.model('User', UserSchema);

const PropertySchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: String, required: true },
    numericPrice: Number,
    rooms: Number,
    bathrooms: Number,
    area: Number,
    description: String,
    imageUrl: String,
    imageUrls: [String],
    type: { type: String, required: true },
    hiddenCode: { type: String, required: true, unique: true }
});
const Property = mongoose.model('Property', PropertySchema);


app.post('/api/add-property', upload.array('propertyImages', 10), async (req, res) => {
    const { title, price, rooms, bathrooms, area, description, type, hiddenCode } = req.body;
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'يجب رفع صورة واحدة على الأقل' });
    }
    
    const imageUrls = req.files.map(file => file.path); 
    const mainImageUrl = imageUrls[0];
    const numericPrice = parseFloat(price.replace(/,/g, ''));

    if (!title || !price || !type || !hiddenCode) {
        return res.status(400).json({ message: 'خطأ: الحقول الأساسية مطلوبة' });
    }
    
    try {
        const newProperty = new Property({
            title, price, numericPrice, rooms, bathrooms, area, description,
            imageUrl: mainImageUrl,
            imageUrls: imageUrls,
            type, hiddenCode
        });
        const savedProperty = await newProperty.save();
        res.status(201).json({ message: 'تم إضافة العقار بنجاح!', id: savedProperty._id });
    } catch (err) {
        if (err.code === 11000) { 
             return res.status(400).json({ message: 'خطأ: الكود السري ده مستخدم قبل كده' });
        }
        console.error('--- ADD PROPERTY ERROR ---'); 
        console.error(err.stack || err.message || JSON.stringify(err));
        console.error('--- ERROR END ---');
        res.status(500).json({ message: 'خطأ في السيرفر عند الإضافة' });
    }
});

app.put('/api/update-property/:id', upload.array('propertyImages', 10), async (req, res) => {
    const propertyId = req.params.id;
    const { title, price, rooms, bathrooms, area, description, type, hiddenCode, existingImages } = req.body;
    
    let existingImageUrls = JSON.parse(existingImages || '[]');
    const newImageUrls = req.files ? req.files.map(file => file.path) : []; 
    
    const allImageUrls = [...existingImageUrls, ...newImageUrls];
    const mainImageUrl = allImageUrls.length > 0 ? allImageUrls[0] : null;
    const numericPrice = parseFloat(price.replace(/,/g, ''));

    if (!title || !price || !type || !hiddenCode) {
        return res.status(400).json({ message: 'خطأ: الحقول الأساسية مطلوبة' });
    }

    try {
        const updatedProperty = await Property.findByIdAndUpdate(propertyId, {
            title, price, numericPrice, rooms, bathrooms, area, description,
            imageUrl: mainImageUrl,
            imageUrls: allImageUrls,
            type, hiddenCode
        }, { new: true }); 

        if (!updatedProperty) {
            return res.status(404).json({ message: 'لم يتم العثور على العقار لتحديثه' });
        }
        res.status(200).json({ message: 'تم تحديث العقار بنجاح!' });
    } catch (err) {
        console.error('--- UPDATE PROPERTY ERROR ---');
        console.error(err.stack || err.message || JSON.stringify(err));
        console.error('--- ERROR END ---');
        res.status(500).json({ message: 'خطأ في السيرفر عند التحديث' });
    }
});


app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'يرجى ملء جميع الحقول' });
    }
    try {
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({ message: 'هذا البريد الإلكتروني مسجل بالفعل' });
        }
        
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const user = new User({ name, email, password: hashedPassword, role: 'user' });
        await user.save();
        res.status(201).json({ success: true, message: 'تم إنشاء الحساب بنجاح!' });
    } catch (err) {
        console.error(err.stack || err.message || JSON.stringify(err));
        res.status(500).json({ message: 'خطأ في السيرفر' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.json({ success: true, role: 'admin' });
    }
    try {
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(401).json({ message: 'الإيميل أو كلمة المرور غير صحيحة' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            res.json({ success: true, role: user.role });
        } else {
            res.status(401).json({ message: 'الإيميل أو كلمة المرور غير صحيحة' });
        }
    } catch (err) {
        console.error(err.stack || err.message || JSON.stringify(err));
        res.status(500).json({ message: 'خطأ في السيرفر' });
    }
});

app.get('/api/properties', async (req, res) => {
    try {
        const { type, limit, keyword, minPrice, maxPrice, rooms } = req.query;
        let query = {};
        
        if (type === 'buy') query.type = 'بيع';
        if (type === 'rent') query.type = 'إيجار';
        if (keyword) {
            query.$or = [
                { title: { $regex: keyword, $options: 'i' } },
                { description: { $regex: keyword, $options: 'i' } }
            ];
        }
        if (minPrice) query.numericPrice = { $gte: Number(minPrice) };
        if (maxPrice) {
            if (query.numericPrice) query.numericPrice.$lte = Number(maxPrice);
            else query.numericPrice = { $lte: Number(maxPrice) };
        }
        if (rooms) {
            if (rooms === '4+') query.rooms = { $gte: 4 };
            else query.rooms = Number(rooms);
        }

        let findQuery = Property.find(query, 'id title price rooms bathrooms area imageUrl')
                            .sort({ _id: -1 });

        if (limit) findQuery = findQuery.limit(parseInt(limit, 10));

        const properties = await findQuery;
        res.json(properties);
    } catch (err) {
        console.error('--- GET PROPERTIES ERROR ---');
        console.error(err.stack || err.message || JSON.stringify(err));
        console.error('--- ERROR END ---');
        res.status(500).json({ "error": err.message });
    }
});

app.get('/api/property/:id', async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (property) {
            res.json(property);
        } else {
            res.status(404).json({ "message": "Property not found" });
        }
    } catch (err) {
        console.error(err.stack || err.message || JSON.stringify(err));
        res.status(500).json({ "error": err.message });
    }
});

app.get('/api/property-by-code/:code', async (req, res) => {
    try {
        const property = await Property.findOne({ hiddenCode: req.params.code }, 'id title price hiddenCode');
        if (property) {
            res.json(property);
        } else {
            res.status(404).json({ "message": "Property not found" });
        }
    } catch (err) {
        console.error(err.stack || err.message || JSON.stringify(err));
        res.status(500).json({ "error": err.message });
    }
});

app.delete('/api/property/:id', async (req, res) => {
    try {
        await Property.findByIdAndDelete(req.params.id);
        res.json({ message: 'Property deleted successfully' });
    } catch (err) {
        console.error(err.stack || err.message || JSON.stringify(err));
        res.status(500).json({ "error": err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});