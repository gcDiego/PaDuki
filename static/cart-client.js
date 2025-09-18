document.addEventListener('DOMContentLoaded', () => {
    const cartItemsList = document.getElementById('cart-items');
    const cartTotalSpan = document.getElementById('cart-total');
    const checkoutButton = document.getElementById('checkout-button');
    const cartSection = document.querySelector('.cart-section');

    let cart = JSON.parse(sessionStorage.getItem('shoppingCart')) || {};

    function updateCartUI() {
        cartItemsList.innerHTML = '';
        let total = 0;

        if (Object.keys(cart).length === 0) {
            cartItemsList.innerHTML = '<li class="cart-empty-message">Tu carrito está vacío.</li>';
            checkoutButton.disabled = true;
        } else {
            checkoutButton.disabled = false;
        }

        for (const id in cart) {
            const item = cart[id];
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div class="cart-item-left">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                    <div class="cart-item-details">
                        <span class="cart-item-name">${item.name}</span>
                        <!-- ¡NUEVO! Controles de cantidad -->
                        <div class="cart-item-quantity-controls">
                            <button class="quantity-change-button" data-id="${id}" data-change="-1">-</button>
                            <span class="item-quantity-display">${item.quantity}</span>
                            <button class="quantity-change-button" data-id="${id}" data-change="1">+</button>
                        </div>
                    </div>
                </div>
                <div class="cart-item-right">
                    <span class="cart-item-price">${(item.price * item.quantity / 100).toFixed(2)} USD</span>
                    <button class="remove-item-button" data-id="${id}">&times;</button>
                </div>
            `;
            cartItemsList.appendChild(listItem);
            total += item.price * item.quantity;
        }

        cartTotalSpan.textContent = (total / 100).toFixed(2);
    }

    // --- MANEJO DE EVENTOS DEL CARRITO ---
    cartItemsList.addEventListener('click', (event) => {
        const target = event.target;

        // Si se hace clic en el botón de eliminar
        if (target.classList.contains('remove-item-button')) {
            const itemId = target.dataset.id;
            delete cart[itemId];
        }

        // Si se hace clic en un botón de cambiar cantidad
        if (target.classList.contains('quantity-change-button')) {
            const itemId = target.dataset.id;
            const change = parseInt(target.dataset.change, 10);

            if (cart[itemId]) {
                cart[itemId].quantity += change;
                // Si la cantidad llega a 0 o menos, eliminar el artículo
                if (cart[itemId].quantity <= 0) {
                    delete cart[itemId];
                }
            }
        }

        // Actualizar sessionStorage y la UI si ocurrió algún cambio
        if (target.classList.contains('remove-item-button') || target.classList.contains('quantity-change-button')) {
            sessionStorage.setItem('shoppingCart', JSON.stringify(cart));
            updateCartUI();
        }
    });

    // --- LÓGICA DE PAGO (sin cambios) ---
    checkoutButton.addEventListener('click', async () => {
        const totalAmount = Object.values(cart).reduce((sum, item) => sum + item.price * item.quantity, 0);
        const itemsForBackend = Object.values(cart).map(item => ({ 
            name: item.name, 
            quantity: item.quantity, 
            wallet: item.wallet,
            price: item.price
        }));

        if (totalAmount <= 0) return;

        try {
            const response = await fetch('/iniciar-pago', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    amount: totalAmount, 
                    items: itemsForBackend,
                    currency: 'USD'
                }),
            });

            if (!response.ok) throw new Error((await response.json()).error || 'Error al iniciar el pago.');

            const data = await response.json();
            if (data.interactUrl) {
                window.open(data.interactUrl, '_blank');
                sessionStorage.setItem('paymentContinueInfo', JSON.stringify(data.continueInfo));
                sessionStorage.setItem('paymentPaymentInfo', JSON.stringify(data.paymentInfo));
                pollForPaymentConfirmation();
            }
        } catch (error) {
            console.error('Error en el checkout:', error);
            alert(error.message);
        }
    });

    function pollForPaymentConfirmation() {
        cartSection.innerHTML = '<h2>Esperando aprobación del pago...</h2><p>Por favor, completa el pago en la nueva pestaña.</p>';
        const pollInterval = 3000;
        const maxAttempts = 40;
        let attempts = 0;

        const intervalId = setInterval(async () => {
            if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                cartSection.innerHTML = '<h2>El pago ha expirado</h2><p>Por favor, inténtalo de nuevo.</p><a href="/cart" class="btn-volver">Volver al Carrito</a>';
                return;
            }
            attempts++;

            try {
                const continueInfo = JSON.parse(sessionStorage.getItem('paymentContinueInfo'));
                const paymentInfo = JSON.parse(sessionStorage.getItem('paymentPaymentInfo'));
                if (!continueInfo || !paymentInfo) {
                    clearInterval(intervalId);
                    return;
                }

                const response = await fetch('/finalizar-pago', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ continueInfo, paymentInfo }),
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        clearInterval(intervalId);
                        cartSection.innerHTML = `<h2>¡Pago Aprobado!</h2><p>Gracias por tu compra.</p><p>ID del Pago: ${result.paymentId}</p><a href="/" class="btn-volver">Volver a la Tienda</a>`;
                        sessionStorage.removeItem('shoppingCart');
                        sessionStorage.removeItem('paymentContinueInfo');
                        sessionStorage.removeItem('paymentPaymentInfo');
                    }
                }
            } catch (error) {
                console.error('Error durante el polling:', error);
            }
        }, pollInterval);
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('interaction_nonce') && urlParams.has('interaction_ref')) {
        pollForPaymentConfirmation();
    } else {
        updateCartUI();
    }
});
