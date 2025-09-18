document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000';

    // --- Elementos de la página (pueden o no existir dependiendo de la página) ---
    const payButton = document.getElementById('pay-button');
    const statusEl = document.getElementById('status');
    const finalResultEl = document.getElementById('final-result');
    const paymentIdEl = document.getElementById('payment-id');
    const checkoutContainer = document.querySelector('.checkout-container');

    /**
     * Función general para inicializar todos los precios en la página.
     * Busca cualquier elemento con 'data-price-cents', lee el valor y actualiza la UI dentro de ese elemento.
     */
    function initializePriceDisplays() {
        const elementsWithPrice = document.querySelectorAll('[data-price-cents]');

        elementsWithPrice.forEach(element => {
            const priceInCents = element.dataset.priceCents;
            if (!priceInCents) return;

            const priceInDollars = (parseInt(priceInCents, 10) / 100).toFixed(2);
            const formattedPrice = `$${priceInDollars}`;

            // Actualizar el elemento de texto del precio dentro del contenedor
            const priceDisplayEl = element.querySelector('.precio');
            if (priceDisplayEl) {
                priceDisplayEl.textContent = formattedPrice;
            }

            // Lógica específica para la página de checkout: actualizar también el botón de pago
            if (element.classList.contains('producto-seleccionado') && payButton) {
                payButton.textContent = `💳 Pagar ${formattedPrice}`;
                payButton.dataset.price = priceInCents;
            }
        });
    }

    // --- Lógica de Pago (solo se activa si hay un botón de pago en la página) ---
    if (payButton) {
        payButton.addEventListener('click', async () => {
            payButton.disabled = true;
            statusEl.textContent = 'Iniciando pago, por favor espera...';

            const amount = payButton.dataset.price;

            if (!amount) {
                statusEl.textContent = 'Error: No se pudo determinar el precio del producto.';
                payButton.disabled = false;
                return;
            }

            try {
                const response = await fetch(`${API_URL}/iniciar-pago`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: amount })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'El servidor no pudo iniciar la transacción.');
                }
                
                const data = await response.json();

                window.open(data.interactUrl, '_blank');
                statusEl.textContent = 'Por favor, aprueba el pago en la nueva pestaña...';

                pollForCompletion(data.continueInfo, data.paymentInfo);

            } catch (error) {
                statusEl.textContent = `Error: ${error.message}`;
                payButton.disabled = false;
            }
        });
    }

    // --- Función de Sondeo (Polling) ---
    async function pollForCompletion(continueInfo, paymentInfo) {
        const pollFrequency = 3000;
        const maxPollTime = 180000;
        const pollStartTime = Date.now();

        const pollingInterval = setInterval(async () => {
            if (document.hidden) return;

            if (Date.now() - pollStartTime > maxPollTime) {
                clearInterval(pollingInterval);
                statusEl.textContent = 'El tiempo de espera ha expirado. Por favor, recarga la página.';
                if(payButton) payButton.disabled = false;
                return;
            }

            try {
                const response = await fetch(`${API_URL}/finalizar-pago`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ continueInfo, paymentInfo })
                });

                if (response.status === 408) return; // Continuar sondeo

                if (!response.ok) throw new Error('Ocurrió un error al verificar el estado del pago.');

                const result = await response.json();

                if (result.success) {
                    clearInterval(pollingInterval);
                    statusEl.textContent = '';
                    
                    if(checkoutContainer) checkoutContainer.style.display = 'none';
                    if(paymentIdEl) paymentIdEl.textContent = result.paymentId;
                    if(finalResultEl) finalResultEl.style.display = 'block';
                }

            } catch (error) {
                console.error('Error durante el sondeo:', error.message);
            }
        }, pollFrequency);
    }

    // --- INICIALIZACIÓN DE LA PÁGINA ---
    // Al cargar, se inicializan todos los precios que encuentre la página.
    initializePriceDisplays();
});
