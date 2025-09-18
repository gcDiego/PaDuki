document.addEventListener('DOMContentLoaded', () => {
    // --- MAPA DE WALLETS (NO VISIBLE EN EL FRONTEND) ---
    // Aquí asocias el ID de cada producto con su wallet correspondiente.
    // Deberás reemplazar los valores con tus datos reales.
    const productWallets = {
        'article-1': 'https://ilp.interledger-test.dev/b4cf7100',
        'article-2': 'https://iilp.interledger-test.dev/ad9f6241',
        'article-3': 'https://ilp.interledger-test.dev/chavez',
    };

    const addToCartButtons = document.querySelectorAll('.add-to-cart-button');

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }

    addToCartButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const productCard = event.target.closest('.producto-card');
            const id = productCard.dataset.id;
            const name = productCard.dataset.name;
            const price = parseInt(productCard.dataset.price, 10);
            const imageSrc = productCard.querySelector('.producto-imagen img').src;
            
            // ¡NUEVO! Obtener la wallet desde el mapa secreto
            const wallet = productWallets[id];

            const cart = JSON.parse(sessionStorage.getItem('shoppingCart')) || {};

            if (cart[id]) {
                cart[id].quantity++;
            } else {
                cart[id] = {
                    name: name,
                    price: price,
                    quantity: 1,
                    image: imageSrc,
                    wallet: wallet // ¡NUEVO! Guardar la wallet en el objeto del carrito
                };
            }

            sessionStorage.setItem('shoppingCart', JSON.stringify(cart));
            
            showToast(`'${name}' se agregó al carrito`);
        });
    });
});
