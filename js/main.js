let productsData = []; 
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentSubCategory = 'all';
let currentModalProductId = null;

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.href.includes('login=success')) {
        window.history.replaceState({}, document.title, "index.html");
    }

    // 從後端 json 讀取資料
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            productsData = data;
            initApp(); 
        })
        .catch(error => {
            console.error("無法載入 JSON 資料:", error);
        });
});

function initApp() {
    updateCartCount();
    injectModalHTML();
    
    if (document.getElementById('featured-products')) renderHomepageRecommendation();
    if (document.getElementById('all-products-grid')) {
        renderProducts(productsData, 'all-products-grid');
        setupFilterEvents();
    }
    if (document.getElementById('cart-items-container')) {
        renderCartItems();
        setupCheckoutForm();
    }
    
    const infoDiv = document.getElementById('current-pet-info');
    if (infoDiv && currentUser && currentUser.pet) {
        infoDiv.innerHTML = `
            <h3>❤️ 歡迎回來，${currentUser.name}！目前正為您的愛寵【${currentUser.pet.breed || '小寶貝'}】精選推薦</h3>
            <p>設定條件：<strong>${currentUser.pet.type} / ${currentUser.pet.age}階段 / ${currentUser.pet.size}體型</strong>。 <a href="member.html">修改資料</a></p>
        `;
    }
}

function updateCartCount() {
    let totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    const countSpan = document.getElementById('cart-count');
    const countSpan2 = document.getElementById('cart-count2');
    if (countSpan) countSpan.innerText = totalQty;
    if (countSpan2) countSpan2.innerText = totalQty;
}

function renderHomepageRecommendation() {
    let displayProducts = [...productsData];
    if (currentUser && currentUser.pet && currentUser.pet.type) {
        displayProducts.sort((a, b) => {
            let scoreA = (a.category === currentUser.pet.type ? 10 : 0) + (a.age === currentUser.pet.age ? 5 : 0);
            let scoreB = (b.category === currentUser.pet.type ? 10 : 0) + (b.age === currentUser.pet.age ? 5 : 0);
            return scoreB - scoreA;
        });
    }
    renderProducts(displayProducts.slice(0, 4), 'featured-products');
}

function renderProducts(products, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    products.forEach(p => {
        const isMatched = currentUser && currentUser.pet && p.category === currentUser.pet.type;
        const matchTag = isMatched ? `<span class="tag tag-highlight">👍 專屬推薦</span>` : '';
        
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => openModal(p.id);
        card.innerHTML = `
            <div class="product-img">${p.icon}</div>
            <div class="product-info">
                <h3>${p.name}</h3>
                <div class="rating-info">⭐ ${p.rating}</div>
                <div><span class="tag">${p.category}</span> ${matchTag}</div>
                <div class="price">NT$ ${p.price}</div>
                <p style="font-size: 0.85rem; color: #888;">點擊查看商品詳情與評論</p>
            </div>
        `;
        container.appendChild(card);
    });
}

function setupFilterEvents() {
    const searchInput = document.getElementById('search-input');
    if(!searchInput) return;
    const filterPet = document.getElementById('filter-pet');
    const filterAge = document.getElementById('filter-age');
    const categoryListItems = document.querySelectorAll('#category-list li');

    const applyFilters = () => {
        let searchTerm = searchInput.value.toLowerCase();
        let petType = filterPet.value;
        let petAge = filterAge.value;

        let filtered = productsData.filter(p => {
            let matchSearch = p.name.toLowerCase().includes(searchTerm);
            let matchPet = petType === "" || p.category === petType;
            let matchAge = petAge === "" || p.age === petAge;
            let matchSub = currentSubCategory === 'all' || p.subCategory === currentSubCategory;
            return matchSearch && matchPet && matchAge && matchSub;
        });
        renderProducts(filtered, 'all-products-grid');
    };

    searchInput.addEventListener('input', applyFilters);
    filterPet.addEventListener('change', applyFilters);
    filterAge.addEventListener('change', applyFilters);

    categoryListItems.forEach(item => {
        item.addEventListener('click', (e) => {
            categoryListItems.forEach(li => li.classList.remove('active'));
            e.target.classList.add('active');
            currentSubCategory = e.target.getAttribute('data-cat');
            applyFilters();
        });
    });
}

function injectModalHTML() {
    if (!document.getElementById('product-modal')) {
        const html = `
        <div id="product-modal" class="modal">
            <div class="modal-content">
                <span class="close-btn" onclick="closeModal()">&times;</span>
                <div id="modal-body"></div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }
}

window.openModal = function(productId) {
    const item = productsData.find(p => p.id === productId);
    if (!item) return;
    currentModalProductId = productId;

    const modal = document.getElementById('product-modal');
    const body = document.getElementById('modal-body');
    
    const sizeOptionHtml = item.subCategory === "服飾與飾品" ? 
        `<div style="margin: 10px 0;"><label>選擇尺寸：</label><select id="modal-size"><option value="S">S</option><option value="M">M</option><option value="L">L</option></select></div>` : '';

    let allReviews = JSON.parse(localStorage.getItem('reviews')) || [];
    let productReviews = allReviews.filter(r => r.productId === productId);
    let reviewsHtml = productReviews.length > 0 
        ? productReviews.map(r => `<div class="review-item"><strong>${r.userName}</strong> <span style="color:#f39c12;">${'⭐'.repeat(r.rating)}</span><br><small style="color:#888;">${r.date}</small><p style="margin: 5px 0;">${r.text}</p></div>`).join('')
        : `<p style="color:#888;">尚無使用者評論，來搶頭香吧！</p>`;

    body.innerHTML = `
        <div class="modal-product-layout">
            <div class="modal-img">${item.icon}</div>
            <div class="modal-info">
                <h2>${item.name}</h2>
                <div class="rating-info">⭐ ${item.rating} (${item.reviews + productReviews.length} 則評論)</div>
                <p>${item.description}</p>
                <div class="price" style="font-size: 1.6rem;">NT$ ${item.price}</div>
                ${sizeOptionHtml}
                <div class="qty-control">
                    <button type="button" onclick="changeModalQty(-1)">-</button>
                    <input type="number" id="modal-qty" value="1" readonly>
                    <button type="button" onclick="changeModalQty(1)">+</button>
                </div>
                <button class="btn btn-block" onclick="addToCartFromModal()">加入購物車</button>
            </div>
        </div>
        
        <div class="review-section">
            <h3>💬 買家評論</h3>
            <div id="modal-review-list">${reviewsHtml}</div>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <h4>📝 新增您的評論</h4>
                <div class="form-group"><label>給予評分：</label><select id="new-review-rating"><option value="5">⭐⭐⭐⭐⭐ (5分)</option><option value="4">⭐⭐⭐⭐ (4分)</option><option value="3">⭐⭐⭐ (3分)</option></select></div>
                <div class="form-group"><textarea id="new-review-text" rows="3" placeholder="寫下您對此商品的看法..."></textarea></div>
                <button class="btn" onclick="submitReview()">送出評論</button>
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

window.closeModal = function() { document.getElementById('product-modal').style.display = 'none'; }
window.changeModalQty = function(delta) {
    let input = document.getElementById('modal-qty');
    let val = parseInt(input.value) + delta;
    if (val >= 1 && val <= 20) input.value = val;
}

window.addToCartFromModal = function() {
    const item = productsData.find(p => p.id === currentModalProductId);
    let qty = parseInt(document.getElementById('modal-qty').value);
    let sizeSelect = document.getElementById('modal-size');
    let size = sizeSelect ? sizeSelect.value : null;

    let existItem = cart.find(c => c.id === currentModalProductId && c.size === size);
    if (existItem) existItem.qty += qty;
    else cart.push({ ...item, qty: qty, size: size });

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    alert(`已將 ${qty} 件【${item.name}】加入購物車！`);
    closeModal();
}

window.submitReview = function() {
    let text = document.getElementById('new-review-text').value;
    let rating = parseInt(document.getElementById('new-review-rating').value);
    
    if (text.trim() === "") { alert("請輸入評論內容！"); return; }
    
    if (!currentUser) {
        alert("您必須先登入會員才能留下評論喔！");
        window.location.href = "member.html";
        return;
    }

    const item = productsData.find(p => p.id === currentModalProductId);
    let allReviews = JSON.parse(localStorage.getItem('reviews')) || [];
    
    let newReview = {
        productId: item.id,
        productName: item.name,
        userName: currentUser.name, 
        date: new Date().toLocaleDateString(),
        rating: rating,
        text: text
    };

    allReviews.push(newReview);
    localStorage.setItem('reviews', JSON.stringify(allReviews));
    
    alert("評論已成功送出！此紀錄已同步保存至您的會員中心。");
    openModal(currentModalProductId); 
}

/* ================= 購物車與結帳邏輯 ================= */
function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;
    container.innerHTML = "";

    if (cart.length === 0) {
        container.innerHTML = "<p>購物車目前空空如也，快去商品總覽逛逛吧！</p>";
        calculateTotal();
        return;
    }

    cart.forEach((item, index) => {
        // 尺寸選擇器
        let sizeSelectHtml = item.size ? `
            <select style="padding: 5px; border: 1px solid #ddd; border-radius: 4px; outline: none;" onchange="updateCartItem(${index}, 'size', this.value)">
                <option value="S" ${item.size==='S'?'selected':''}>尺寸 S</option>
                <option value="M" ${item.size==='M'?'selected':''}>尺寸 M</option>
                <option value="L" ${item.size==='L'?'selected':''}>尺寸 L</option>
            </select>` : '';

        // 新增：購物車專用的 + - 數量控制 UI
        let qtyControlHtml = `
            <div class="cart-qty-control">
                <button type="button" onclick="changeCartQty(${index}, -1)">-</button>
                <input type="number" value="${item.qty}" readonly>
                <button type="button" onclick="changeCartQty(${index}, 1)">+</button>
            </div>
        `;

        const itemRow = document.createElement('div');
        itemRow.className = 'cart-item';
        itemRow.innerHTML = `
            <div style="font-size:2.5rem; margin-right:15px; width: 60px; text-align:center;">${item.icon}</div>
            <div style="flex:1;">
                <h4 style="margin:0 0 8px 0;">${item.name}</h4>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    ${sizeSelectHtml}
                    ${qtyControlHtml}
                </div>
            </div>
            <div style="font-weight:bold; color:#e67e22; margin-right:15px; min-width: 80px; text-align:right;">NT$ ${item.price * item.qty}</div>
            <button class="btn btn-secondary" style="padding:8px 12px;" onclick="removeFromCart(${index})">刪除</button>
        `;
        container.appendChild(itemRow);
    });
    calculateTotal();
}

// 購物車內的 + - 按鈕功能
window.changeCartQty = function(index, delta) {
    let newVal = cart[index].qty + delta;
    if (newVal >= 1 && newVal <= 20) {
        cart[index].qty = newVal;
        localStorage.setItem('cart', JSON.stringify(cart));
        renderCartItems(); // 重新渲染畫面並更新金額
        updateCartCount();
    }
}

// 更改尺寸專用
window.updateCartItem = function(index, field, value) {
    if (field === 'size') {
        cart[index].size = value;
        localStorage.setItem('cart', JSON.stringify(cart));
    }
}

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCartItems();
    updateCartCount();
}

window.calculateTotal = function() {
    if (!document.getElementById('cart-subtotal')) return;
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let shippingMethod = document.getElementById('shipping-method') ? document.getElementById('shipping-method').value : 'store';
    let shippingBaseFee = (shippingMethod === 'home') ? 110 : 65;
    let shippingDiscount = 0;
    
    if (subtotal >= 3000) {
        shippingDiscount = shippingBaseFee; 
        document.getElementById('free-shipping-row').style.display = 'block';
    } else {
        document.getElementById('free-shipping-row').style.display = 'none';
    }
    let finalTotal = subtotal + shippingBaseFee - shippingDiscount;

    document.getElementById('cart-subtotal').innerText = subtotal;
    document.getElementById('cart-shipping').innerText = shippingBaseFee;
    document.getElementById('cart-discount').innerText = shippingDiscount;
    document.getElementById('cart-total').innerText = finalTotal;
}

function setupCheckoutForm() {
    const shipSelect = document.getElementById('shipping-method');
    const paySelect = document.getElementById('payment-method');
    const allDynamicFields = document.querySelectorAll('.dynamic-field');

    shipSelect.addEventListener('change', () => {
        document.getElementById('address-label').innerText = shipSelect.value === 'store' ? "取貨門市名稱：" : "宅配完整地址：";
        calculateTotal();
    });

    paySelect.addEventListener('change', () => {
        allDynamicFields.forEach(f => f.style.display = 'none');
        let val = paySelect.value;
        if (val === 'credit') document.getElementById('field-credit').style.display = 'block';
        if (val === 'transfer') document.getElementById('field-transfer').style.display = 'block';
        if (['linepay', 'applepay', 'jkopay'].includes(val)) document.getElementById('field-mobilepay').style.display = 'block';
    });

    document.getElementById('checkout-form').addEventListener('submit', function(e) {
        e.preventDefault();
        if (cart.length === 0) { alert("購物車是空的喔！"); return; }
        
        if (!currentUser) {
            alert("結帳前請先登入會員帳號！");
            window.location.href = "member.html";
            return;
        }

        let finalTotal = document.getElementById('cart-total').innerText;
        let allOrders = JSON.parse(localStorage.getItem('orders')) || [];
        
        // 綁定訂單給當前會員
        allOrders.push({
            orderId: 'ORD-' + Math.floor(Math.random()*1000000),
            userName: currentUser.name, // 關鍵：綁定姓名
            date: new Date().toLocaleDateString(),
            total: finalTotal,
            items: cart
        });
        localStorage.setItem('orders', JSON.stringify(allOrders));

        alert('🎉 訂單已成功成立！訂單明細已保存至您的會員中心。');
        localStorage.removeItem('cart');
        window.location.href = 'index.html';
    });
}