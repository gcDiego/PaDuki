# PaDuki con Pagos Interledger

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
-   Crear la base de datos llamada test
-   Crear la tabla con el script bd

### Pasos

1.  **Clona el repositorio (o usa tus archivos locales):**
2.  **Instalar las librerias**: npm install @interledger/open-payments && npm install dotenv
3.  Correr el código a partir de archivo pagos.js y abrir el enlace generado en consola

    

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

#ENGLISH
# PaDuki with Interledger Payments

- **Dynamic Notifications:** Non-intrusive "Toast" messages that confirm actions such as adding a product to the cart.

- **Shopping Cart on Separate Page:** The cart lives on its own route (`/cart`) for a better user experience.

- **Complete Cart Management:**

- Add products.

- Adjust the quantity of each product (`+` / `-`).

- Eliminate products individually.

- **Session Storage:** The cart persists while you browse the store, but is automatically cleaned when you close the tab (`sessionStorage`).

- **Modern Payment Flow:**

- The payment authorization page opens in a **new tab**, allowing the cart page to remain active.

- The cart page **actively awaits ("polling")** for payment confirmation, showing a "Payment Approved" message in real time without the need to recharge.

- **Robust Backend:**

- Node.js server with Express.

- Orchestrate the flow of Open Payments (creation of `incomingPayment`, `quote` and `outgoingPayment`).

- **Records in console a detailed JSON object** of each purchase attempt, ready to be stored in a database.

---

## 🛠️ Technological Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)

- **Backend:** Node.js, Express.js

- **Payments:** `@interledger/open-payments`

- **Additional Dependencies:** `cors`

---

## 📂 Project Structure

Payments_app without cart/ │ ├── templates/ │ ├── index.html # Home page that shows the products. │ └�── cart.html # Page dedicated to the shopping cart. │ ├── static/ │ ├─── style.css # Main style sheet for the entire application. │ ├── client.js # Script for the index.html page (add to cart). │ └�─ cart-client.js # Script for the cart.html page (cart management and Payment). │ ├── payments.js # The backend server (Node.js + Express). ├── package.json # Defines the project's dependencies and scripts. └── README.md # This file.

---

## ⚙️ Installation and Configuration

Follow these steps to start the project in your local environment.

### Prerequisites

- Have Node.js installed (version 16 or higher).- Create the database called test

- Create the table with the script bd

### Steps

1. **Clone the repository (or use your local files):**

2. **Install libraries**: npm install @interledger/open-payments && npm install dotenv

3. Run the code from the pagos.js file and open the link generated in the console



## ⚙️ Application Flow

### 1. Shopping Cart Logic

The cart uses `sessionStorage` to persist the data during the user's navigation session.

1. **Add Product:** On the main page, `client.js` captures the product data and its associated `wallet` from an internal map. Then, save this object in the `sessionStorage`.

2. **View Cart:** On the `/cart` page, the `cart-client.js` script reads the `sessionStorage` data and dynamically renders the product list.

3. **Modify Cart:** Any change (adjust quantity or delete) is made directly in the `sessionStorage` and the interface is rendered again with the function `updateCartUI()`.



### 2. Asynchronous Payment Flow (Polling)

In order not to interrupt the user experience, payment is made in a separate tab.

1. **Start Payment:** The user clicks on "Pay Now". `cart-client.js` sends the cart details to the endpoint `/start-payment`.

2. **Open Tab:** The backend returns an `interactUrl`. The frontend opens it in a new tab (`window.open`).

3. **Wait and Verify:** The original cart page shows a "Waiting..." message and starts a `setInterval` that calls the endpoint `/finalize-payment` every 3 seconds.

4. **Confirmation:** When the user approves the payment in the new tab, the next call to `/finalizar-pago` is successful. The backend returns `success: true`.

5. **Update UI:** The frontend receives confirmation, stops the `setInterval`, shows the message "Payment Approved!" And clean the cart.
