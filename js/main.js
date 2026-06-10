const STORE = {
    cart: "cart",
    currentUser: "currentUser",
    users: "usersDB",
    orders: "orders",
    lastOrder: "lastOrder"
};

let productsData = [];
let cart = readStorage(STORE.cart, []);
let currentUser = readStorage(STORE.currentUser, null);

document.addEventListener("DOMContentLoaded", async () => {
    setupHeader();
    setupGlobalSearch();

    try {
        const response = await fetch("data.json");
        if (!response.ok) throw new Error("商品資料讀取失敗");
        productsData = await response.json();
    } catch (error) {
        console.error(error);
        showPageMessage("商品資料暫時無法載入，請稍後再試。");
        return;
    }

    renderHomePage();
    setupProductsPage();
    renderProductDetailPage();
    renderCartPage();
    setupCheckoutPage();
    renderOrderSuccessPage();
});

function readStorage(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function money(value) {
    return new Intl.NumberFormat("zh-TW").format(Number(value) || 0);
}

function getProduct(productId) {
    return productsData.find(product => product.id === Number(productId));
}

function getCartDetails() {
    return cart.map(item => {
        const product = getProduct(item.id) || item;
        return { ...product, qty: Number(item.qty) || 1 };
    }).filter(item => item.id);
}

function setupHeader() {
    updateCartCount();
    document.querySelectorAll("[data-member-link]").forEach(link => {
        link.href = currentUser ? "member.html" : "login.html";
        link.textContent = currentUser ? `嗨，${currentUser.name}` : "會員登入";
    });

    const menuButton = document.querySelector(".menu-toggle");
    const nav = document.querySelector(".nav-links");
    menuButton?.addEventListener("click", () => {
        const opened = nav.classList.toggle("is-open");
        menuButton.setAttribute("aria-expanded", String(opened));
    });
}

function setupGlobalSearch() {
    document.querySelectorAll(".global-search-form").forEach(form => {
        form.addEventListener("submit", event => {
            event.preventDefault();
            const keyword = form.querySelector("input")?.value.trim() || "";
            window.location.href = `products.html?q=${encodeURIComponent(keyword)}`;
        });
    });
}

function updateCartCount() {
    const total = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    document.querySelectorAll("[data-cart-count]").forEach(element => {
        element.textContent = total;
    });
}

function getMatchScore(product) {
    const pet = currentUser?.pet;
    if (!pet) return 0;

    let score = 0;
    if (product.petType === pet.type) score += 10;
    if (product.age.includes(pet.age)) score += 4;
    if (product.size.includes(pet.size)) score += 3;

    const healthNeeds = Array.isArray(pet.health) ? pet.health : [pet.health].filter(Boolean);
    healthNeeds.forEach(need => {
        if (product.healthTags.includes(need)) score += 2;
    });

    const allergyText = (pet.allergy || "").toLowerCase();
    if (allergyText && product.allergens.some(item => allergyText.includes(item.toLowerCase()))) {
        score -= 20;
    }
    return score;
}

function sortByRecommendation(products) {
    return [...products].sort((a, b) => {
        const scoreDifference = getMatchScore(b) - getMatchScore(a);
        return scoreDifference || b.rating - a.rating;
    });
}

function compatibility(product) {
    const pet = currentUser?.pet;
    if (!pet) return { className: "", label: "" };
    if (product.petType !== pet.type) return { className: "match-neutral", label: "其他寵物適用" };

    const allergyText = (pet.allergy || "").toLowerCase();
    const hasAllergyRisk = allergyText && product.allergens.some(item => allergyText.includes(item.toLowerCase()));
    if (hasAllergyRisk) return { className: "match-warning", label: "注意過敏成分" };
    if (product.age.includes(pet.age) && product.size.includes(pet.size)) {
        return { className: "match-good", label: "適合我的毛孩" };
    }
    return { className: "match-check", label: "請確認年齡與體型" };
}

function productCard(product) {
    const match = compatibility(product);
    return `
        <article class="product-card">
            <a class="product-image-wrap" href="product.html?id=${product.id}" aria-label="查看${product.name}">
                <img src="${product.image}" alt="${product.name}" loading="lazy">
                ${match.label ? `<span class="match-badge ${match.className}">${match.label}</span>` : ""}
            </a>
            <div class="product-info">
                <div class="product-meta">${product.petType}・${product.age.join("／")}</div>
                <h3><a href="product.html?id=${product.id}">${product.name}</a></h3>
                <p>${product.description}</p>
                <div class="rating-row"><span>★ ${product.rating}</span><span>${product.reviews} 則評價</span></div>
                <div class="product-card-bottom">
                    <strong class="price">NT$ ${money(product.price)}</strong>
                    <button class="btn btn-small" type="button" data-add-cart="${product.id}">加入購物車</button>
                </div>
            </div>
        </article>
    `;
}

function bindAddCartButtons(container = document) {
    container.querySelectorAll("[data-add-cart]").forEach(button => {
        button.addEventListener("click", () => {
            addToCart(Number(button.dataset.addCart), 1);
            showToast("已加入購物車");
        });
    });
}

function renderHomePage() {
    const petPanel = document.getElementById("home-pet-panel");
    const recommendationGrid = document.getElementById("featured-products");
    if (!petPanel || !recommendationGrid) return;

    if (currentUser?.pet) {
        const pet = currentUser.pet;
        petPanel.innerHTML = `
            <div class="pet-avatar">${pet.type === "狗" ? "🐶" : pet.type === "貓" ? "🐱" : pet.type === "兔子" ? "🐰" : "🐹"}</div>
            <div class="pet-panel-copy">
                <span class="eyebrow">我的寵物資料</span>
                <h2>${pet.breed || pet.type}・${pet.age}・${pet.size}</h2>
                <p>健康需求：${pet.health?.length ? pet.health.join("、") : "目前沒有特別需求"}<br>過敏資訊：${pet.allergy || "未填寫"}</p>
                <a class="text-link" href="member.html">查看或修改資料 →</a>
            </div>
        `;
    } else {
        petPanel.innerHTML = `
            <div class="pet-avatar">🐾</div>
            <div class="pet-panel-copy">
                <span class="eyebrow">我的寵物資料</span>
                <h2>先告訴我們家裡住著誰</h2>
                <p>填寫種類、年齡與健康需求，找商品時就不用每次重新比對。</p>
                <a class="btn" href="register.html">建立毛孩資料</a>
            </div>
        `;
    }

    const recommendations = sortByRecommendation(productsData).slice(0, 4);
    recommendationGrid.innerHTML = recommendations.map(productCard).join("");
    bindAddCartButtons(recommendationGrid);
}

function setupProductsPage() {
    const grid = document.getElementById("all-products-grid");
    if (!grid) return;

    const controls = {
        keyword: document.getElementById("search-input"),
        pet: document.getElementById("filter-pet"),
        age: document.getElementById("filter-age"),
        size: document.getElementById("filter-size"),
        category: document.getElementById("filter-category")
    };
    const resultCount = document.getElementById("result-count");
    const query = new URLSearchParams(window.location.search);
    controls.keyword.value = query.get("q") || "";
    controls.pet.value = query.get("pet") || "";
    controls.category.value = query.get("category") || "";

    const applyFilters = () => {
        const keyword = controls.keyword.value.trim().toLowerCase();
        const filtered = productsData.filter(product => {
            const searchable = `${product.name} ${product.description} ${product.ingredients}`.toLowerCase();
            return (!keyword || searchable.includes(keyword))
                && (!controls.pet.value || product.petType === controls.pet.value)
                && (!controls.age.value || product.age.includes(controls.age.value))
                && (!controls.size.value || product.size.includes(controls.size.value))
                && (!controls.category.value || product.category === controls.category.value);
        });

        const sorted = sortByRecommendation(filtered);
        resultCount.textContent = `找到 ${sorted.length} 件商品`;
        grid.innerHTML = sorted.length
            ? sorted.map(productCard).join("")
            : `<div class="empty-state full-span"><span>🔎</span><h3>沒有符合條件的商品</h3><p>換個關鍵字，或少選一個條件再看看。</p></div>`;
        bindAddCartButtons(grid);
    };

    Object.values(controls).forEach(control => {
        control.addEventListener(control.tagName === "INPUT" ? "input" : "change", applyFilters);
    });
    document.getElementById("clear-filters")?.addEventListener("click", () => {
        Object.values(controls).forEach(control => { control.value = ""; });
        applyFilters();
    });
    applyFilters();
}

function renderProductDetailPage() {
    const container = document.getElementById("product-detail");
    if (!container) return;

    const productId = new URLSearchParams(window.location.search).get("id");
    const product = getProduct(productId);
    if (!product) {
        container.innerHTML = `<div class="empty-state"><h2>找不到這項商品</h2><a class="btn" href="products.html">回商品總覽</a></div>`;
        return;
    }

    document.title = `${product.name} | 萌寵商城`;
    const match = compatibility(product);
    container.innerHTML = `
        <nav class="breadcrumb" aria-label="麵包屑">
            <a href="index.html">首頁</a><span>／</span><a href="products.html">商品總覽</a><span>／</span><span>${product.name}</span>
        </nav>
        <section class="product-detail-layout">
            <div class="product-detail-image"><img src="${product.image}" alt="${product.name}"></div>
            <div class="product-detail-info">
                <span class="eyebrow">${product.category}</span>
                <h1>${product.name}</h1>
                <div class="rating-row large"><span>★ ${product.rating}</span><span>${product.reviews} 則評價</span></div>
                ${match.label ? `<div class="compatibility ${match.className}">${match.label}</div>` : ""}
                <p class="lead">${product.description}</p>
                <strong class="detail-price">NT$ ${money(product.price)}</strong>
                <dl class="spec-list">
                    <div><dt>適用寵物</dt><dd>${product.petType}</dd></div>
                    <div><dt>適用年齡</dt><dd>${product.age.join("、")}</dd></div>
                    <div><dt>體型限制</dt><dd>${product.size.join("、")}</dd></div>
                    <div><dt>主要成分</dt><dd>${product.ingredients}</dd></div>
                </dl>
                <div class="notice-box"><strong>購買前請留意</strong><p>${product.notice}</p></div>
                <div class="purchase-row">
                    <div class="qty-control" aria-label="商品數量">
                        <button type="button" id="qty-minus" aria-label="減少數量">−</button>
                        <input id="product-qty" type="number" value="1" min="1" max="20" readonly>
                        <button type="button" id="qty-plus" aria-label="增加數量">＋</button>
                    </div>
                    <button class="btn btn-secondary" type="button" id="detail-add-cart">加入購物車</button>
                    <button class="btn" type="button" id="buy-now">直接購買</button>
                </div>
            </div>
        </section>
        <section class="related-section">
            <div class="section-heading"><div><span class="eyebrow">也可以看看</span><h2>適合一起帶回家的商品</h2></div></div>
            <div class="product-grid" id="related-products"></div>
        </section>
    `;

    const quantity = document.getElementById("product-qty");
    document.getElementById("qty-minus").addEventListener("click", () => {
        quantity.value = Math.max(1, Number(quantity.value) - 1);
    });
    document.getElementById("qty-plus").addEventListener("click", () => {
        quantity.value = Math.min(20, Number(quantity.value) + 1);
    });
    document.getElementById("detail-add-cart").addEventListener("click", () => {
        addToCart(product.id, Number(quantity.value));
        showToast(`已加入 ${quantity.value} 件商品`);
    });
    document.getElementById("buy-now").addEventListener("click", () => {
        addToCart(product.id, Number(quantity.value));
        window.location.href = "cart.html";
    });

    const related = sortByRecommendation(productsData.filter(item =>
        item.id !== product.id && (item.petType === product.petType || item.category === product.category)
    )).slice(0, 3);
    const relatedGrid = document.getElementById("related-products");
    relatedGrid.innerHTML = related.map(productCard).join("");
    bindAddCartButtons(relatedGrid);
}

function addToCart(productId, quantity = 1) {
    const existing = cart.find(item => Number(item.id) === Number(productId));
    if (existing) existing.qty = Math.min(20, Number(existing.qty) + quantity);
    else cart.push({ id: Number(productId), qty: Math.min(20, quantity) });
    writeStorage(STORE.cart, cart);
    updateCartCount();
}

function changeCartQuantity(productId, delta) {
    const item = cart.find(cartItem => Number(cartItem.id) === Number(productId));
    if (!item) return;
    item.qty = Math.min(20, Math.max(1, Number(item.qty) + delta));
    writeStorage(STORE.cart, cart);
    renderCartPage();
    updateCartCount();
}

function removeCartItem(productId) {
    cart = cart.filter(item => Number(item.id) !== Number(productId));
    writeStorage(STORE.cart, cart);
    renderCartPage();
    updateCartCount();
}

function renderCartPage() {
    const container = document.getElementById("cart-items-container");
    if (!container) return;

    const details = getCartDetails();
    const subtotal = details.reduce((sum, item) => sum + item.price * item.qty, 0);
    const checkoutButton = document.getElementById("go-checkout");

    if (!details.length) {
        container.innerHTML = `
            <div class="empty-state">
                <span>🛒</span><h2>購物車還是空的</h2>
                <p>先去逛逛，找到適合家中毛孩的用品吧。</p>
                <a class="btn" href="products.html">前往商品總覽</a>
            </div>`;
        checkoutButton?.setAttribute("aria-disabled", "true");
        checkoutButton?.classList.add("is-disabled");
    } else {
        container.innerHTML = details.map(item => `
            <article class="cart-item">
                <a class="cart-item-image" href="product.html?id=${item.id}"><img src="${item.image}" alt="${item.name}"></a>
                <div class="cart-item-main">
                    <div>
                        <span class="product-meta">${item.petType}・${item.category}</span>
                        <h3><a href="product.html?id=${item.id}">${item.name}</a></h3>
                        <span class="unit-price">單價 NT$ ${money(item.price)}</span>
                    </div>
                    <div class="cart-item-actions">
                        <div class="qty-control">
                            <button type="button" data-cart-minus="${item.id}" aria-label="減少${item.name}數量">−</button>
                            <input type="number" value="${item.qty}" readonly aria-label="${item.name}數量">
                            <button type="button" data-cart-plus="${item.id}" aria-label="增加${item.name}數量">＋</button>
                        </div>
                        <button class="text-button danger" type="button" data-cart-remove="${item.id}">移除</button>
                    </div>
                </div>
                <strong class="cart-line-total">NT$ ${money(item.price * item.qty)}</strong>
            </article>
        `).join("");
        checkoutButton?.removeAttribute("aria-disabled");
        checkoutButton?.classList.remove("is-disabled");
    }

    document.getElementById("cart-subtotal").textContent = money(subtotal);
    document.getElementById("cart-total").textContent = money(subtotal);
    document.querySelectorAll("[data-cart-minus]").forEach(button => {
        button.addEventListener("click", () => changeCartQuantity(button.dataset.cartMinus, -1));
    });
    document.querySelectorAll("[data-cart-plus]").forEach(button => {
        button.addEventListener("click", () => changeCartQuantity(button.dataset.cartPlus, 1));
    });
    document.querySelectorAll("[data-cart-remove]").forEach(button => {
        button.addEventListener("click", () => removeCartItem(button.dataset.cartRemove));
    });
    checkoutButton?.addEventListener("click", event => {
        if (!details.length) event.preventDefault();
    });
}

function shippingFee(method, subtotal) {
    if (!subtotal || subtotal >= 3000) return 0;
    return method === "store" ? 65 : 100;
}

function setupCheckoutPage() {
    const form = document.getElementById("checkout-form");
    if (!form) return;

    const details = getCartDetails();
    if (!details.length) {
        window.location.href = "cart.html";
        return;
    }

    const nameInput = document.getElementById("receiver-name");
    const emailInput = document.getElementById("receiver-email");
    if (currentUser) {
        nameInput.value = currentUser.name || "";
        emailInput.value = currentUser.email || "";
    }

    const shippingSelect = document.getElementById("shipping-method");
    const paymentSelect = document.getElementById("payment-method");
    const cardFields = document.getElementById("credit-card-fields");

    const renderSummary = () => {
        const subtotal = details.reduce((sum, item) => sum + item.price * item.qty, 0);
        const fee = shippingFee(shippingSelect.value, subtotal);
        document.getElementById("checkout-items").innerHTML = details.map(item => `
            <div class="checkout-item">
                <span>${item.name} × ${item.qty}</span>
                <strong>NT$ ${money(item.price * item.qty)}</strong>
            </div>`).join("");
        document.getElementById("checkout-subtotal").textContent = money(subtotal);
        document.getElementById("checkout-shipping").textContent = fee ? money(fee) : "0（免運）";
        document.getElementById("checkout-total").textContent = money(subtotal + fee);
    };

    shippingSelect.addEventListener("change", renderSummary);
    paymentSelect.addEventListener("change", () => {
        const showCard = paymentSelect.value === "信用卡";
        cardFields.hidden = !showCard;
        cardFields.querySelectorAll("input").forEach(input => { input.required = showCard; });
    });
    renderSummary();

    form.addEventListener("submit", event => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const subtotal = details.reduce((sum, item) => sum + item.price * item.qty, 0);
        const fee = shippingFee(shippingSelect.value, subtotal);
        const now = new Date();
        const orderId = `ORD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
        const order = {
            orderId,
            userEmail: currentUser?.email || document.getElementById("receiver-email").value.trim(),
            userName: currentUser?.name || document.getElementById("receiver-name").value.trim(),
            date: now.toLocaleString("zh-TW"),
            status: "準備中",
            items: details.map(item => ({ id: item.id, name: item.name, price: item.price, qty: item.qty })),
            receiver: {
                name: document.getElementById("receiver-name").value.trim(),
                phone: document.getElementById("receiver-phone").value.trim(),
                email: document.getElementById("receiver-email").value.trim(),
                address: document.getElementById("receiver-address").value.trim()
            },
            shippingMethod: shippingSelect.options[shippingSelect.selectedIndex].text,
            paymentMethod: paymentSelect.value,
            subtotal,
            shipping: fee,
            total: subtotal + fee
        };

        const orders = readStorage(STORE.orders, []);
        orders.push(order);
        writeStorage(STORE.orders, orders);
        writeStorage(STORE.lastOrder, order);
        cart = [];
        writeStorage(STORE.cart, cart);
        window.location.href = "order-success.html";
    });
}

function renderOrderSuccessPage() {
    const container = document.getElementById("order-success-detail");
    if (!container) return;

    const order = readStorage(STORE.lastOrder, null);
    if (!order) {
        container.innerHTML = `<div class="empty-state"><h2>目前沒有可顯示的訂單</h2><a class="btn" href="products.html">回商品總覽</a></div>`;
        return;
    }

    document.getElementById("success-order-id").textContent = order.orderId;
    container.innerHTML = `
        <div class="order-success-grid">
            <section>
                <h2>商品明細</h2>
                ${order.items.map(item => `
                    <div class="checkout-item"><span>${item.name} × ${item.qty}</span><strong>NT$ ${money(item.price * item.qty)}</strong></div>
                `).join("")}
            </section>
            <section>
                <h2>收件資訊</h2>
                <p>${order.receiver.name}<br>${order.receiver.phone}<br>${order.receiver.email}<br>${order.receiver.address}</p>
                <p>${order.shippingMethod}<br>${order.paymentMethod}</p>
            </section>
        </div>
        <div class="success-total"><span>訂單總金額</span><strong>NT$ ${money(order.total)}</strong></div>
    `;
}

function showToast(message) {
    let toast = document.getElementById("site-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "site-toast";
        toast.className = "toast";
        toast.setAttribute("role", "status");
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function showPageMessage(message) {
    const main = document.querySelector("main");
    if (main) main.insertAdjacentHTML("afterbegin", `<div class="page-alert">${message}</div>`);
}
