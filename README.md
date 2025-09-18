# Tienda Online con Pagos Interledger

Este proyecto es una aplicación web de comercio electrónico simple pero completa, diseñada para demostrar un flujo de compra desde la selección de productos hasta la finalización del pago utilizando la API de **Open Payments**.

La aplicación cuenta con una interfaz para mostrar productos, un carrito de compras funcional en una página separada y un backend en Node.js que gestiona la orquestación de los pagos.

---

## Características Principales

-   **Catálogo de Productos:** Interfaz limpia que muestra los productos de la tienda.
-   **Información Detallada al Pasar el Cursor:** Muestra una descripción del producto al pasar el cursor sobre la imagen.
-   **Notificaciones Dinámicas:** Mensajes "Toast" no intrusivos que confirman acciones como agregar un producto al carrito.
-   **Carrito de Compras en Página Separada:** El carrito vive en su propia ruta (`/cart`) para una mejor experiencia de usuario.
-   **Gestión Completa del Carrito:**
    -   Agregar productos.
    -   Ajustar la cantidad de cada producto (`+` / `-`).
    -   Eliminar productos individualmente.
-   **Almacenamiento por Sesión:** El carrito persiste mientras navegas por la tienda, pero se limpia automáticamente al cerrar la pestaña (`sessionStorage`).
-   **Flujo de Pago Moderno:**
    -   La página de autorización del pago se abre en una **nueva pestaña**, permitiendo que la página del carrito permanezca activa.
    -   La página del carrito **espera activamente ("polling")** la confirmación del pago, mostrando un mensaje de "Pago Aprobado" en tiempo real sin necesidad de recargar.
-   **Backend Robusto:**
    -   Servidor Node.js con Express.
    -   Orquesta el flujo de Open Payments (creación de `incomingPayment`, `quote` y `outgoingPayment`).
    -   **Registra en consola un objeto JSON detallado** de cada intento de compra, listo para ser almacenado en una base de datos.

---

## 🛠️ Stack Tecnológico

-   **Frontend:** HTML5, CSS3, JavaScript (ES6+)
-   **Backend:** Node.js, Express.js
-   **Pagos:** `@interledger/open-payments`
-   **Dependencias Adicionales:** `cors`

---

## 📂 Estructura del Proyecto
pagos_app sin carrito/ │ ├── templates/ │   ├── index.html      # Página principal que muestra los productos. │   └── cart.html       # Página dedicada al carrito de compras. │ ├── static/ │   ├── style.css       # Hoja de estilos principal para toda la aplicación. │   ├── client.js       # Script para la página index.html (agregar al carrito). │   └── cart-client.js  # Script para la página cart.html (gestión del carrito y pago). │ ├── pagos.js            # El servidor backend (Node.js + Express). ├── package.json        # Define las dependencias y scripts del proyecto. └── README.md           # Este archivo.


---

## ⚙️ Instalación y Configuración

Sigue estos pasos para poner en marcha el proyecto en tu entorno local.

### Prerrequisitos

-   Tener instalado Node.js (versión 16 o superior).

### Pasos

1.  **Clona el repositorio (o usa tus archivos locales):**
    FALTA

    

## ⚙️ Flujo de la Aplicación

### 1. Lógica del Carrito de Compras

El carrito utiliza `sessionStorage` para persistir los datos durante la sesión de navegación del usuario.

1.  **Agregar Producto:** En la página principal, `client.js` captura los datos del producto y su `wallet` asociada desde un mapa interno. Luego, guarda este objeto en el `sessionStorage`.
2.  **Visualizar Carrito:** En la página `/cart`, el script `cart-client.js` lee los datos del `sessionStorage` y renderiza dinámicamente la lista de productos.
3.  **Modificar Carrito:** Cualquier cambio (ajustar cantidad o eliminar) se realiza directamente en el `sessionStorage` y la interfaz se vuelve a renderizar con la función `updateCartUI()`.

### 2. Flujo de Pago Asíncrono (Polling)

Para no interrumpir la experiencia del usuario, el pago se realiza en una pestaña separada.

1.  **Iniciar Pago:** El usuario hace clic en "Pagar Ahora". `cart-client.js` envía los detalles del carrito al endpoint `/iniciar-pago`.
2.  **Abrir Pestaña:** El backend devuelve una `interactUrl`. El frontend la abre en una nueva pestaña (`window.open`).
3.  **Esperar y Verificar:** La página del carrito original muestra un mensaje de "Esperando..." e inicia un `setInterval` que llama al endpoint `/finalizar-pago` cada 3 segundos.
4.  **Confirmación:** Cuando el usuario aprueba el pago en la nueva pestaña, la siguiente llamada a `/finalizar-pago` tiene éxito. El backend devuelve `success: true`.
5.  **Actualizar UI:** El frontend recibe la confirmación, detiene el `setInterval`, muestra el mensaje "¡Pago Aprobado!" y limpia el carrito.

