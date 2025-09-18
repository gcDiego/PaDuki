// index.js
$(document).ready(async function() {
    const tbody = $("#tabla tbody");

    try {
        const res = await fetch("/api/productos");
        const productos = await res.json();

        if (!productos.length) {
            // Actualizamos el colspan a 8 para la nueva columna
            tbody.append(`<tr><td colspan=\"8\" class=\"text-center\">No hay transacciones</td></tr>`);
        }

        productos.forEach(p => {
            const estadoActual = p.Status ? p.Status.toLowerCase().trim() : '';
            let statusTexto = p.Status || 'Desconocido';
            let botonHTML;

            // Formatear la fecha y hora de creación para que sea legible
            const fechaFormateada = new Date(p.fecha_creacion).toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            switch (estadoActual) {
                case 'pending':
                    statusTexto = 'Pendiente';
                    botonHTML = `<button class=\"btn btn-primary btn-ejecutar\" data-id=\"${p.Transaccion}\">Ejecutar Transacción</button>`;
                    break;
                case 'completado':
                    statusTexto = 'Completado';
                    botonHTML = `<button class=\"btn btn-secondary\" data-id=\"${p.Transaccion}\" disabled>Completado</button>`;
                    break;
                default:
                    statusTexto = 'Error';
                    botonHTML = `<button class=\"btn btn-danger\" data-id=\"${p.Transaccion}\" disabled>Error</button>`;
                    break;
            }

            const totalFormateado = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.Total);

            // Añadimos la nueva celda <td> para la fecha al principio de la fila
            tbody.append(`
                <tr data-id=\"${p.Transaccion}\">
                    <td>${fechaFormateada}</td>
                    <td>${p.Transaccion}</td>
                    <td>${p.Producto}</td>
                    <td>${p.Cantidad}</td>
                    <td>${totalFormateado}</td>
                    <td class=\"status\">${statusTexto}</td>
                    <td>${p.Divisa}</td>
                    <td>${botonHTML}</td>
                </tr>
            `);
        });

        // Inicializar DataTable con el idioma y orden por defecto
        $("#tabla").DataTable({
            language: { lengthMenu: "Mostrar _MENU_ entradas" },
            order: [[0, 'desc']] // Ordenar por la primera columna (fecha) de forma descendente
        });

    } catch (err) {
        console.error("Error cargando productos:", err);
        tbody.append(`<tr><td colspan=\"8\" class=\"text-center\">Error cargando transacciones</td></tr>`);
    }
});

// --- LÓGICA DE PAGO ASÍNCRONO (SIN CAMBIOS) ---
$(document).on("click", ".btn-ejecutar", async function() {
    const boton = $(this);
    const transaccionId = boton.data("id");
    const fila = boton.closest("tr");
    const statusCell = fila.find(".status");

    boton.prop("disabled", true).removeClass('btn-primary').addClass('btn-warning').text("Iniciando...");

    try {
        const initRes = await fetch("/api/iniciar-pago", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaccionId }) });
        const initData = await initRes.json();

        if (!initData.success) { throw new Error(initData.error || "No se pudo iniciar el pago desde el servidor."); }

        const paymentWindow = window.open(initData.interactUrl, '_blank', 'width=800,height=600');
        statusCell.text("Esperando Aprobación");
        boton.text("Esperando Aprobación");

        const poll = setInterval(async () => {
            if (!paymentWindow || paymentWindow.closed) {
                clearInterval(poll);
                statusCell.text("Procesando Pago...");
                boton.text("Procesando Pago...");

                try {
                    const finalRes = await fetch("/api/finalizar-pago", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ continueInfo: initData.continueInfo, paymentInfo: initData.paymentInfo }) });
                    const finalData = await finalRes.json();

                    if (finalData.success) {
                        statusCell.text("Completado");
                        boton.removeClass('btn-warning').addClass('btn-secondary').prop("disabled", true).text("Completado");
                        alert('✅ Transacción completada. ID de Pago: ' + finalData.outgoingPaymentId);
                    } else {
                        throw new Error(finalData.error || "Error desconocido al finalizar el pago.");
                    }
                } catch (finalError) {
                    console.error("Error en la finalización:", finalError);
                    const errorMessage = finalError.message.toLowerCase();

                    if (errorMessage.includes('rechazado') || errorMessage.includes('cancelado')) {
                        statusCell.text("Rechazado");
                        boton.removeClass('btn-warning').addClass('btn-primary').prop("disabled", false).text("Ejecutar Transacción");
                        alert('❌ El pago fue rechazado por el usuario.');
                    } else {
                        statusCell.text("Error");
                        boton.removeClass('btn-warning').addClass('btn-danger').prop("disabled", false).text("Reintentar");
                        alert('❌ Error técnico al finalizar la transacción: ' + finalError.message);
                    }
                }
            }
        }, 1000);

    } catch (initError) {
        console.error("Error iniciando el pago:", initError);
        statusCell.text("Error");
        boton.removeClass('btn-warning').addClass('btn-primary').prop("disabled", false).text("Ejecutar Transacción");
        alert('❌ Error al iniciar la transacción: ' + initError.message);
    }
});
