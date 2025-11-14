document.addEventListener('DOMContentLoaded', () => {
    const userRole = localStorage.getItem('userRole');
    const nav = document.querySelector('.main-nav');

    if (!userRole) {
        return;
    }

    if (userRole === 'admin') {
        if (nav && !document.querySelector('.admin-btn')) {
            const adminButton = document.createElement('a');
            adminButton.href = 'admin.html';
            adminButton.className = 'nav-button neon-button-white admin-btn';
            adminButton.textContent = 'نشر عقار جديد';
            nav.prepend(adminButton);
        }
    }
    
    if (nav && !document.querySelector('.logout-btn')) {
        const logoutButton = document.createElement('a');
        logoutButton.href = '#';
        logoutButton.className = 'nav-button neon-button-white logout-btn';
        logoutButton.textContent = 'تسجيل خروج';
        nav.append(logoutButton);
    }
});