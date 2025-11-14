document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('property-detail-container');
    const loadingMessage = document.getElementById('loading-message');

    let currentImageIndex = 0;
    let imageUrls = [];

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const propertyId = urlParams.get('id');

        if (!propertyId) {
            throw new Error('لم يتم تحديد عقار.');
        }

        const response = await fetch(`/api/property/${propertyId}`);
        if (!response.ok) {
            throw new Error('فشل في جلب تفاصيل العقار.');
        }
        
        const property = await response.json();
        
        loadingMessage.style.display = 'none';
        
        const whatsappNumber = "201008102237"; 
        const message = `مرحباً، أنا مهتم بالعقار: ${property.title} (كود: ${property.id})
---
كود المتابعة السري: ${property.hiddenCode}`;
        const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

        if (property.imageUrls) {
            imageUrls = JSON.parse(property.imageUrls);
        } else if (property.imageUrl) {
            imageUrls.push(property.imageUrl);
        }
        
        const detailHTML = `
            <div class="image-gallery neon-glow">
                <button id="prev-image" class="gallery-nav-btn prev-btn"><i class="fas fa-chevron-left"></i></button>
                <img id="property-main-image" src="${imageUrls[0] || 'https://via.placeholder.com/800x500.png?text=صورة+العقار'}" alt="${property.title}" class="gallery-main-image">
                <button id="next-image" class="gallery-nav-btn next-btn"><i class="fas fa-chevron-right"></i></button>
                <div id="image-thumbnails" class="image-thumbnails">
                </div>
            </div>

            <aside class="property-info neon-glow">
                <h1 class="detail-title">${property.title}</h1>
                <p class="detail-price">${property.price}</p>

                <div class="specs-list">
                    <div class="spec-item">
                        <i class="fas fa-bed"></i>
                        <span>${property.rooms} غرف</span>
                    </div>
                    <div class="spec-item">
                        <i class="fas fa-bath"></i>
                        <span>${property.bathrooms} حمامات</span>
                    </div>
                    <div class="spec-item">
                        <i class="fas fa-ruler-combined"></i>
                        <span>${property.area} م²</span>
                    </div>
                </div>

                <div class="detail-description">
                    <h3>الوصف</h3>
                    <p>${property.description || 'لا يوجد وصف متوفر حالياً.'}</p>
                </div>
                
                <a href="${whatsappLink}" target="_blank" class="btn-neon whatsapp-btn">
                    <i class="fab fa-whatsapp"></i>
                    تواصل معنا للمعاينة
                </a>
            </aside>
        `;
        
        container.innerHTML = detailHTML;

        // --- برمجة الأزرار بعد تحميل الصفحة ---
        const mainImage = document.getElementById('property-main-image');
        const prevBtn = document.getElementById('prev-image');
        const nextBtn = document.getElementById('next-image');
        const thumbnailsContainer = document.getElementById('image-thumbnails');

        function renderThumbnails() {
            thumbnailsContainer.innerHTML = '';
            imageUrls.forEach((url, index) => {
                const thumbnail = document.createElement('img');
                thumbnail.src = url;
                thumbnail.classList.add('thumbnail-image');
                if (index === currentImageIndex) {
                    thumbnail.classList.add('active');
                }
                thumbnail.addEventListener('click', () => {
                    currentImageIndex = index;
                    updateMainImage();
                });
                thumbnailsContainer.appendChild(thumbnail);
            });
            updateNavButtons();
        }

        function updateMainImage() {
            mainImage.style.opacity = 0; // إخفاء الصورة القديمة
            setTimeout(() => {
                mainImage.src = imageUrls[currentImageIndex];
                mainImage.style.opacity = 1; // إظهار الجديدة
            }, 300); // 0.3 ثانية (زي الـ CSS)

            document.querySelectorAll('.thumbnail-image').forEach((thumb, index) => {
                thumb.classList.toggle('active', index === currentImageIndex);
            });
            updateNavButtons();
        }

        function updateNavButtons() {
            prevBtn.disabled = currentImageIndex === 0;
            nextBtn.disabled = currentImageIndex === imageUrls.length - 1;
        }

        prevBtn.addEventListener('click', () => {
            if (currentImageIndex > 0) {
                currentImageIndex--;
                updateMainImage();
            }
        });

        nextBtn.addEventListener('click', () => {
            if (currentImageIndex < imageUrls.length - 1) {
                currentImageIndex++;
                updateMainImage();
            }
        });
        
        if(imageUrls.length > 0) {
            renderThumbnails();
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }

    } catch (error) {
        console.error('Error fetching property details:', error);
        container.innerHTML = `<p class="empty-message">${error.message}</p>`;
    }
});