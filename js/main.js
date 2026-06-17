const STORE = {
    cart: "cart",
    currentUser: "currentUser",
    users: "usersDB",
    orders: "orders",
    lastOrder: "lastOrder",
    reviews: "reviewsDB"
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
    renderPromoCarousel();
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

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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
        <article class="product-card" data-product-link="product.html?id=${product.id}" tabindex="0" role="link" aria-label="查看${product.name}">
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
        button.addEventListener("click", event => {
            event.stopPropagation();
            addToCart(Number(button.dataset.addCart), 1);
            showToast("已加入購物車");
        });
    });
}

function bindProductCards(container = document) {
    container.querySelectorAll("[data-product-link]").forEach(card => {
        const goToProduct = event => {
            if (event.target.closest("a, button")) return;
            window.location.href = card.dataset.productLink;
        };
        card.addEventListener("click", goToProduct);
        card.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            window.location.href = card.dataset.productLink;
        });
    });
}

function renderHomePage() {
    const recommendationGrid = document.getElementById("featured-products");
    if (!recommendationGrid) return;

    const recommendations = sortByRecommendation(productsData).slice(0, 4);
    recommendationGrid.innerHTML = recommendations.map(productCard).join("");
    bindAddCartButtons(recommendationGrid);
    bindProductCards(recommendationGrid);
}

function renderPromoCarousel() {
    const carousel = document.getElementById("promo-carousel");
    if (!carousel) return;

    const promoProducts = sortByRecommendation(productsData).slice(0, 4);
    if (!promoProducts.length) return;

    let activeIndex = 0;
    const renderSlide = () => {
        const product = promoProducts[activeIndex];
        carousel.innerHTML = `
            <a class="promo-slide" href="product.html?id=${product.id}">
                <div class="promo-image"><img src="${product.image}" alt="${product.name}"></div>
                <div class="promo-copy">
                    <span class="eyebrow">點擊看商品</span>
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <div class="rating-row"><span>★ ${product.rating}</span><span>${product.reviews} 則評價</span></div>
                    <strong>NT$ ${money(product.price)}</strong>
                </div>
            </a>
            <div class="promo-dots" aria-label="廣告輪播狀態">
                ${promoProducts.map((_, index) => `<button type="button" class="${index === activeIndex ? "active" : ""}" data-promo-index="${index}" aria-label="查看第 ${index + 1} 張廣告"></button>`).join("")}
            </div>
        `;
        carousel.querySelectorAll("[data-promo-index]").forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                activeIndex = Number(button.dataset.promoIndex);
                renderSlide();
            });
        });
    };

    renderSlide();
    window.setInterval(() => {
        activeIndex = (activeIndex + 1) % promoProducts.length;
        renderSlide();
    }, 4200);
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
        bindProductCards(grid);
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
        <section class="review-section" id="product-reviews">
            <div class="section-heading">
                <div><span class="eyebrow">商品評價</span><h2>買家評價與星等</h2></div>
                <p>包含投稿者、日期、星等與使用心得，方便比較實際使用感受。</p>
            </div>
            <div class="review-layout">
                <div>
                    <div class="review-summary">
                        <strong>★ ${product.rating}</strong>
                        <span>${product.reviews} 則既有評價，加上會員投稿會即時顯示。</span>
                    </div>
                    <div class="review-list" id="product-review-list"></div>
                </div>
                <aside class="review-form-card" id="review-form-card"></aside>
            </div>
        </section>
        <section class="related-section">
            <div class="section-heading"><div><span class="eyebrow">也可以看看</span><h2>適合一起帶回家的商品</h2></div></div>
            <div class="product-grid" id="related-products"></div>
        </section>
    `;

    renderProductReviews(product);
    setupProductReviewForm(product);

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
    bindProductCards(relatedGrid);
}

function sampleReviews(product) {
    return [
        {
            author: `${product.petType}飼主 小安`,
            date: "2026/05/18",
            rating: product.rating,
            comment: `${product.name} 的適用年齡與體型標示很清楚，購買前比較容易判斷是否適合。`
        },
        {
            author: "回購會員 林同學",
            date: "2026/05/02",
            rating: Math.max(4, Math.round((product.rating - 0.2) * 10) / 10),
            comment: `商品說明和注意事項寫得完整，尤其是 ${product.category} 類商品很需要先看成分。`
        }
    ];
}

function getStoredReviews(productId) {
    return readStorage(STORE.reviews, [])
        .filter(review => Number(review.productId) === Number(productId))
        .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
}

function renderProductReviews(product) {
    const list = document.getElementById("product-review-list");
    if (!list) return;

    const reviews = [...getStoredReviews(product.id), ...sampleReviews(product)];
    list.innerHTML = reviews.map(review => `
        <article class="review-card">
            <div class="review-card-head">
                <strong>${escapeHTML(review.author)}</strong>
                <span>${escapeHTML(review.date)}</span>
            </div>
            <div class="review-stars">★ ${escapeHTML(review.rating)}</div>
            <p>${escapeHTML(review.comment)}</p>
        </article>
    `).join("");
}

function setupProductReviewForm(product) {
    const card = document.getElementById("review-form-card");
    if (!card) return;

    if (!currentUser) {
        card.innerHTML = `
            <h3>我要留下評價</h3>
            <p>登入會員後，可以投稿商品評價，並在會員中心查看自己的評價紀錄。</p>
            <a class="btn btn-block" href="login.html">先登入會員</a>
        `;
        return;
    }

    card.innerHTML = `
        <h3>我要留下評價</h3>
        <form id="review-form">
            <div class="form-group">
                <label for="review-rating">星等</label>
                <select id="review-rating" required>
                    <option value="5">5 星，非常滿意</option>
                    <option value="4">4 星，滿意</option>
                    <option value="3">3 星，普通</option>
                    <option value="2">2 星，需要改善</option>
                    <option value="1">1 星，不推薦</option>
                </select>
            </div>
            <div class="form-group">
                <label for="review-comment">使用心得</label>
                <textarea id="review-comment" rows="5" minlength="8" placeholder="請寫下商品使用心得" required></textarea>
            </div>
            <p class="form-message" id="review-message"></p>
            <button class="btn btn-block" type="submit">送出評價</button>
        </form>
    `;

    document.getElementById("review-form").addEventListener("submit", event => {
        event.preventDefault();
        const comment = document.getElementById("review-comment").value.trim();
        const message = document.getElementById("review-message");
        if (comment.length < 8) {
            message.textContent = "心得至少需要 8 個字。";
            message.className = "form-message error";
            return;
        }

        const reviews = readStorage(STORE.reviews, []);
        const now = new Date();
        reviews.push({
            id: `REV${Date.now()}`,
            productId: product.id,
            productName: product.name,
            rating: Number(document.getElementById("review-rating").value),
            comment,
            author: currentUser.name,
            userEmail: currentUser.email,
            date: now.toLocaleDateString("zh-TW"),
            createdAt: now.toISOString()
        });
        writeStorage(STORE.reviews, reviews);
        message.textContent = "評價已送出，會員中心也會顯示這筆紀錄。";
        message.className = "form-message success";
        event.target.reset();
        renderProductReviews(product);
    });
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

function setCartQuantity(productId, quantity) {
    const item = cart.find(cartItem => Number(cartItem.id) === Number(productId));
    if (!item) return;
    item.qty = Math.min(20, Math.max(1, Number(quantity) || 1));
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

function updateShippingProgress(subtotal) {
    const bar = document.getElementById("shipping-progress-bar");
    const text = document.getElementById("shipping-progress-text");
    if (!bar || !text) return;

    const target = 3000;
    const percent = Math.min(100, Math.round((subtotal / target) * 100));
    bar.style.width = `${percent}%`;
    text.textContent = subtotal >= target
        ? "已達免運門檻"
        : `再 NT$ ${money(target - subtotal)} 免運`;
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
                            <input type="number" value="${item.qty}" min="1" max="20" inputmode="numeric" data-cart-qty="${item.id}" aria-label="${item.name}數量">
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
    updateShippingProgress(subtotal);
    document.querySelectorAll("[data-cart-minus]").forEach(button => {
        button.addEventListener("click", () => changeCartQuantity(button.dataset.cartMinus, -1));
    });
    document.querySelectorAll("[data-cart-plus]").forEach(button => {
        button.addEventListener("click", () => changeCartQuantity(button.dataset.cartPlus, 1));
    });
    document.querySelectorAll("[data-cart-qty]").forEach(input => {
        input.addEventListener("change", () => setCartQuantity(input.dataset.cartQty, input.value));
        input.addEventListener("blur", () => setCartQuantity(input.dataset.cartQty, input.value));
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
