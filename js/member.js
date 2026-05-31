document.addEventListener("DOMContentLoaded", () => {
    // UI 元件
    const tabs = document.querySelectorAll('#member-tabs li');
    const contents = document.querySelectorAll('.tab-content');
    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');
    const loggedInSection = document.getElementById('logged-in-section');
    const petConfirmModal = document.getElementById('pet-confirm-modal');
    
    // 初始化模擬資料庫 (Users Table)
    let usersDB = JSON.parse(localStorage.getItem('usersDB')) || [];
    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

    // 1. 處理頁籤切換
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.style.display = 'none');
            tab.classList.add('active');
            document.getElementById('section-' + tab.getAttribute('data-target')).style.display = 'block';
        });
    });

    // 2. 登入與註冊表單切換
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        registerSection.style.display = 'none';
        loginSection.style.display = 'block';
    });

    // 3. 檢查登入狀態並渲染介面
    if (currentUser) {
        loginSection.style.display = 'none';
        registerSection.style.display = 'none';
        loggedInSection.style.display = 'block';
        document.getElementById('welcome-msg').innerText = `歡迎回來，${currentUser.name}！`;
        
        // 顯示左側隱藏的歷史紀錄按鈕
        document.getElementById('tab-orders').style.display = 'block';
        document.getElementById('tab-reviews').style.display = 'block';
        tabs[0].innerText = "個人資料";

        renderUserHistory(currentUser.name);
    }

    // 4. 註冊邏輯
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        let name = document.getElementById('reg-name').value;
        let email = document.getElementById('reg-email').value;
        
        // 檢查是否已註冊
        if (usersDB.find(u => u.email === email)) {
            alert("此信箱已註冊過，請直接登入！");
            return;
        }

        let newUser = {
            name: name,
            email: email,
            pet: {
                type: document.getElementById('reg-pet-type').value,
                breed: document.getElementById('reg-pet-breed').value,
                age: document.getElementById('reg-pet-age').value,
                size: document.getElementById('reg-pet-size').value
            }
        };

        usersDB.push(newUser);
        localStorage.setItem('usersDB', JSON.stringify(usersDB));
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        
        alert("註冊成功！將為您跳轉至首頁。");
        window.location.href = "index.html?login=success";
    });

    // 5. 登入邏輯
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        let name = document.getElementById('login-name').value;
        let email = document.getElementById('login-email').value;

        // 從 UsersDB 中尋找使用者
        let user = usersDB.find(u => u.email === email && u.name === name);
        if (user) {
            // 登入成功：不直接跳轉，先跳出寵物確認浮框
            localStorage.setItem('currentUser', JSON.stringify(user));
            
            // 填入先前的寵物資料
            document.getElementById('conf-pet-type').value = user.pet.type;
            document.getElementById('conf-pet-breed').value = user.pet.breed;
            document.getElementById('conf-pet-age').value = user.pet.age;
            document.getElementById('conf-pet-size').value = user.pet.size;

            petConfirmModal.style.display = 'block';
        } else {
            alert("找不到該會員，請確認姓名與信箱是否正確，或先進行註冊！");
        }
    });

    // 6. 寵物資料確認後跳轉
    document.getElementById('pet-confirm-form').addEventListener('submit', (e) => {
        e.preventDefault();
        let updatedUser = JSON.parse(localStorage.getItem('currentUser'));
        
        // 更新寵物資料
        updatedUser.pet = {
            type: document.getElementById('conf-pet-type').value,
            breed: document.getElementById('conf-pet-breed').value,
            age: document.getElementById('conf-pet-age').value,
            size: document.getElementById('conf-pet-size').value
        };
        
        // 存回系統
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        
        // 同步更新 usersDB 裡的資料
        let userIndex = usersDB.findIndex(u => u.email === updatedUser.email);
        if (userIndex !== -1) {
            usersDB[userIndex] = updatedUser;
            localStorage.setItem('usersDB', JSON.stringify(usersDB));
        }

        alert("寵物資料已確認！為您跳轉至首頁開始購物！");
        window.location.href = "index.html?login=success";
    });

    // 7. 登出
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        alert("已成功登出！");
        window.location.reload();
    });

    // 8. 渲染專屬歷史紀錄 (訂單與評論)
    function renderUserHistory(userName) {
        // 渲染專屬訂單
        let allOrders = JSON.parse(localStorage.getItem('orders')) || [];
        let myOrders = allOrders.filter(o => o.userName === userName);
        const orderContainer = document.getElementById('order-history-list');
        
        if (myOrders.length === 0) {
            orderContainer.innerHTML = "<p style='color:#888;'>您目前尚無任何訂單紀錄。</p>";
        } else {
            orderContainer.innerHTML = myOrders.reverse().map(order => {
                let itemsList = order.items.map(i => `${i.name} (x${i.qty})`).join('、');
                return `
                <div class="history-item">
                    <strong>訂單編號：#${order.orderId}</strong> <span class="tag tag-highlight">處理中</span><br>
                    <small style="color:#777;">購買日期：${order.date} | 總結帳金額：NT$ ${order.total}</small>
                    <p style="margin: 5px 0; font-size: 0.9rem;">商品明細：${itemsList}</p>
                </div>`;
            }).join('');
        }

        // 渲染專屬評論
        let allReviews = JSON.parse(localStorage.getItem('reviews')) || [];
        let myReviews = allReviews.filter(r => r.userName === userName);
        const reviewContainer = document.getElementById('review-history-list');
        
        if (myReviews.length === 0) {
            reviewContainer.innerHTML = "<p style='color:#888;'>您目前尚未留下任何評論紀錄。</p>";
        } else {
            reviewContainer.innerHTML = myReviews.reverse().map(r => `
                <div class="history-item">
                    <strong>評論商品：${r.productName}</strong><br>
                    <span style="color:#f39c12;">${'⭐'.repeat(r.rating)}</span> <small style="color:#888;">${r.date}</small>
                    <p style="margin: 5px 0;">${r.text}</p>
                </div>
            `).join('');
        }
    }
});