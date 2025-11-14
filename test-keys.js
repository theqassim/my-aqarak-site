require('dotenv').config();
const cloudinary = require('cloudinary').v2;

console.log("--- بدء اختبار المفاتيح ---");

try {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    console.log("تم قراءة المفاتيح من .env بنجاح.");
    console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);

    cloudinary.api.ping((error, result) => {
        if (error) {
            console.error("--- !!! خطأ فادح !!! ---");
            console.error("Cloudinary فشل في الاتصال. المفاتيح غلط أو فيها مسافات.");
            console.error(error);
        } else {
            console.log("--- !!! نجاح !!! ---");
            console.log("اتصلت بـ Cloudinary بنجاح!");
            console.log(result);
        }
    });

} catch (err) {
    console.error("--- خطأ في الكود نفسه ---");
    console.error(err);
}