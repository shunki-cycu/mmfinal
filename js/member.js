document.addEventListener("DOMContentLoaded", () => {
    setupLoginForm();
    setupRegisterForm();
    setupMemberCenter();
});

function memberRead(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function memberWrite(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function setupLoginForm() {
    const form = document.getElementById("login-form");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();
        const email = document.getElementById("login-email").value.trim().toLowerCase();
        const password = document.getElementById("login-password").value;
        const users = memberRead("usersDB", []);
        const user = users.find(item => item.email.toLowerCase() === email && item.password === password);
        const message = document.getElementById("login-message");

        if (!user) {
            message.textContent = "電子信箱或密碼不正確，請再確認一次。";
            message.className = "form-message error";
            return;
        }

        memberWrite("currentUser", user);
        message.textContent = "登入成功，正在回到首頁。";
        message.className = "form-message success";
        window.setTimeout(() => { window.location.href = "index.html"; }, 500);
    });
}

function setupRegisterForm() {
    const form = document.getElementById("register-form");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();
        const password = document.getElementById("register-password").value;
        const confirmPassword = document.getElementById("register-password-confirm").value;
        const email = document.getElementById("register-email").value.trim().toLowerCase();
        const message = document.getElementById("register-message");
        const users = memberRead("usersDB", []);

        if (password.length < 6) {
            message.textContent = "密碼至少需要 6 個字元。";
            message.className = "form-message error";
            return;
        }
        if (password !== confirmPassword) {
            message.textContent = "兩次輸入的密碼不一致。";
            message.className = "form-message error";
            return;
        }
        if (users.some(user => user.email.toLowerCase() === email)) {
            message.textContent = "這個電子信箱已經註冊過了，可以直接登入。";
            message.className = "form-message error";
            return;
        }

        const health = Array.from(document.querySelectorAll('input[name="health"]:checked')).map(input => input.value);
        const newUser = {
            name: document.getElementById("register-name").value.trim(),
            email,
            password,
            pet: {
                type: document.getElementById("register-pet-type").value,
                breed: document.getElementById("register-pet-breed").value.trim(),
                age: document.getElementById("register-pet-age").value,
                size: document.getElementById("register-pet-size").value,
                health,
                allergy: document.getElementById("register-allergy").value.trim()
            }
        };

        users.push(newUser);
        memberWrite("usersDB", users);
        memberWrite("currentUser", newUser);
        message.textContent = "資料已儲存，接著幫你的毛孩挑商品吧。";
        message.className = "form-message success";
        window.setTimeout(() => { window.location.href = "index.html"; }, 600);
    });
}

function setupMemberCenter() {
    const dashboard = document.getElementById("member-dashboard");
    if (!dashboard) return;

    const user = memberRead("currentUser", null);
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    document.getElementById("member-name").textContent = user.name;
    document.getElementById("member-email").textContent = user.email;
    const form = document.getElementById("pet-edit-form");
    document.getElementById("edit-pet-type").value = user.pet.type;
    document.getElementById("edit-pet-breed").value = user.pet.breed || "";
    document.getElementById("edit-pet-age").value = user.pet.age;
    document.getElementById("edit-pet-size").value = user.pet.size;
    document.getElementById("edit-allergy").value = user.pet.allergy || "";
    document.querySelectorAll('input[name="edit-health"]').forEach(input => {
        input.checked = (user.pet.health || []).includes(input.value);
    });

    form.addEventListener("submit", event => {
        event.preventDefault();
        const updatedUser = {
            ...user,
            pet: {
                type: document.getElementById("edit-pet-type").value,
                breed: document.getElementById("edit-pet-breed").value.trim(),
                age: document.getElementById("edit-pet-age").value,
                size: document.getElementById("edit-pet-size").value,
                health: Array.from(document.querySelectorAll('input[name="edit-health"]:checked')).map(input => input.value),
                allergy: document.getElementById("edit-allergy").value.trim()
            }
        };
        const users = memberRead("usersDB", []);
        const index = users.findIndex(item => item.email === updatedUser.email);
        if (index >= 0) users[index] = updatedUser;
        memberWrite("usersDB", users);
        memberWrite("currentUser", updatedUser);
        const message = document.getElementById("pet-edit-message");
        message.textContent = "毛孩資料已更新，推薦商品也會跟著調整。";
        message.className = "form-message success";
    });

    const orders = memberRead("orders", []).filter(order =>
        order.userEmail === user.email || order.userName === user.name
    ).reverse();
    const orderList = document.getElementById("member-order-list");
    orderList.innerHTML = orders.length ? orders.map(order => `
        <article class="order-history-card">
            <div><strong>${order.orderId}</strong><span>${order.date}</span></div>
            <p>${order.items.map(item => `${item.name} × ${item.qty}`).join("、")}</p>
            <div><span class="status-pill">${order.status || "準備中"}</span><strong>NT$ ${new Intl.NumberFormat("zh-TW").format(order.total)}</strong></div>
        </article>
    `).join("") : `<div class="empty-state compact"><p>目前還沒有訂單紀錄。</p><a class="text-link" href="products.html">去逛逛商品 →</a></div>`;

    document.getElementById("logout-button").addEventListener("click", () => {
        localStorage.removeItem("currentUser");
        window.location.href = "index.html";
    });
}
