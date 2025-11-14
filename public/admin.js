document.addEventListener('DOMContentLoaded', () => {
    const userRole = localStorage.getItem('userRole');
    
    if (userRole !== 'admin') {
        alert('ليس لديك صلاحية للوصول لهذه الصفحة');
        window.location.href = 'home.html';
        return;
    }

    // --- عناصر الفورم ---
    const addForm = document.getElementById('admin-property-form');
    const messageEl = document.getElementById('admin-message');
    const imageInput = document.getElementById('admin-image-upload');
    const previewContainer = document.getElementById('admin-image-preview-container');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    let currentEditId = null; 

    let allSelectedFiles = []; 

    imageInput.addEventListener('change', () => {
        const files = imageInput.files;
        if (!files) return;
        allSelectedFiles.push(...files); 
        updateImagePreview();
    });

    function updateImagePreview() {
        previewContainer.innerHTML = ''; 
        allSelectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'preview-image-wrapper';
                
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-image';
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-image-btn';
                removeBtn.innerText = 'X';
                removeBtn.type = 'button';
                removeBtn.onclick = () => removeImage(index);
                
                imgContainer.appendChild(img);
                imgContainer.appendChild(removeBtn);
                previewContainer.appendChild(imgContainer);
            }
            if (typeof file === 'string') {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'preview-image-wrapper';
                const img = document.createElement('img');
                img.src = file; 
                img.className = 'preview-image';
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-image-btn';
                removeBtn.innerText = 'X';
                removeBtn.type = 'button';
                removeBtn.onclick = () => removeImage(index);
                imgContainer.appendChild(img);
                imgContainer.appendChild(removeBtn);
                previewContainer.appendChild(imgContainer);
            } else {
                reader.readAsDataURL(file);
            }
        });
    }

    function removeImage(index) {
        allSelectedFiles.splice(index, 1); 
        updateImagePreview(); 
    }

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageEl.textContent = 'جاري الحفظ...';
        messageEl.className = '';

        const formData = new FormData();
        formData.append('title', document.getElementById('title').value);
        formData.append('price', document.getElementById('price').value);
        formData.append('rooms', parseInt(document.getElementById('rooms').value, 10));
        formData.append('bathrooms', parseInt(document.getElementById('bathrooms').value, 10));
        formData.append('area', parseInt(document.getElementById('area').value, 10));
        formData.append('description', document.getElementById('description').value);
        formData.append('type', document.getElementById('type').value);
        formData.append('hiddenCode', document.getElementById('hiddenCode').value);
        
        allSelectedFiles.forEach(file => {
            formData.append('propertyImages', file);
        });

        let apiUrl = '/api/add-property';
        let method = 'POST';

        if (currentEditId) {
            apiUrl = `/api/update-property/${currentEditId}`;
            method = 'PUT';
            formData.append('existingImages', JSON.stringify(allSelectedFiles.filter(f => typeof f === 'string')));
        } else {
            if (allSelectedFiles.length === 0) {
                messageEl.textContent = 'يجب اختيار صورة واحدة على الأقل.';
                messageEl.className = 'error';
                return;
            }
        }

        try {
            const response = await fetch(apiUrl, {
                method: method,
                body: formData, 
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل في حفظ العقار');
            }

            const result = await response.json();
            messageEl.textContent = result.message;
            messageEl.className = 'success';
            resetForm();

        } catch (error) {
            messageEl.textContent = error.message;
            messageEl.className = 'error';
        }
    });

    function resetForm() {
        addForm.reset();
        allSelectedFiles = [];
        updateImagePreview();
        currentEditId = null;
        formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> إضافة عقار جديد';
        submitBtn.innerHTML = 'نشر العقار الآن';
        submitBtn.style.backgroundColor = '';
    }

    const searchBtn = document.getElementById('search-code-btn');
    const searchInput = document.getElementById('search-code-input');
    const deleteResults = document.getElementById('delete-results');

    searchBtn.addEventListener('click', async () => {
        const code = searchInput.value;
        if (!code) {
            deleteResults.innerHTML = '<p class="delete-message error">يرجى إدخال كود سري.</p>';
            return;
        }

        deleteResults.innerHTML = '<p class="delete-message">جاري البحث...</p>';

        try {
            const response = await fetch(`/api/property-by-code/${code}`);
            if (!response.ok) {
                throw new Error('لم يتم العثور على عقار بهذا الكود.');
            }
            
            const property = await response.json();
            
            deleteResults.innerHTML = `
                <div class="found-property">
                    <h4>${property.title}</h4>
                    <p>السعر: ${property.price}</p>
                    <p>الكود السري: ${property.hiddenCode}</p>
                    <button class="btn-neon edit-btn" data-id="${property.id}">
                        <i class="fas fa-edit"></i> تعديل هذا العقار
                    </button>
                    <button class="btn-neon delete-confirm-btn" data-id="${property.id}">
                        <i class="fas fa-trash-alt"></i> حذف هذا العقار
                    </button>
                </div>
            `;
        } catch (error) {
            deleteResults.innerHTML = `<p class="delete-message error">${error.message}</p>`;
        }
    });

    deleteResults.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const propertyId = target.dataset.id;

        if (target.classList.contains('delete-confirm-btn')) {
            if (!confirm('هل أنت متأكد أنك تريد حذف هذا العقار؟ لا يمكن التراجع عن هذا الأمر.')) {
                return;
            }
            try {
                const response = await fetch(`/api/property/${propertyId}`, {
                    method: 'DELETE',
                });
                if (!response.ok) throw new Error('فشل في عملية الحذف.');
                deleteResults.innerHTML = '<p class="delete-message success">تم حذف العقار بنجاح!</p>';
                searchInput.value = '';
            } catch (error) {
                deleteResults.innerHTML = `<p class="delete-message error">${error.message}</p>`;
            }
        }

        if (target.classList.contains('edit-btn')) {
            try {
                const response = await fetch(`/api/property/${propertyId}`);
                if (!response.ok) throw new Error('لا يمكن جلب بيانات العقار للتعديل.');
                const property = await response.json();
                
                document.getElementById('title').value = property.title;
                document.getElementById('price').value = property.price;
                document.getElementById('rooms').value = property.rooms;
                document.getElementById('bathrooms').value = property.bathrooms;
                document.getElementById('area').value = property.area;
                document.getElementById('description').value = property.description;
                document.getElementById('type').value = property.type;
                document.getElementById('hiddenCode').value = property.hiddenCode;

                allSelectedFiles = JSON.parse(property.imageUrls || '[]');
                updateImagePreview();
                
                currentEditId = property.id;
                formTitle.innerHTML = '<i class="fas fa-edit"></i> تعديل العقار';
                submitBtn.innerHTML = 'تحديث البيانات';
                submitBtn.style.backgroundColor = '#28a745';
                
                window.scrollTo(0, 0); 
                deleteResults.innerHTML = '';
                searchInput.value = '';

            } catch (error) {
                alert(error.message);
            }
        }
    });
});