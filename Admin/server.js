// server.js
import express from "express";
import bodyParser from "body-parser";
import {
    createAuthenticatedClient,
    isFinalizedGrant,
    OpenPaymentsClientError
} from "@interledger/open-payments";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

const app = express();
app.use(bodyParser.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));

// --- CONFIGURACIÓN DE CLIENTE (TOMADA DE TU SCRIPT) ---
const PRIVATE_KEY_PATH = '-----BEGIN PRIVATE KEY-----\n' +
    'MC4CAQAwBQYDK2VwBCIEIFsAglug3nLbjpzhFqnUAc5KxfYzD6JWpBHshVtjhv4r\n' +
    '-----END PRIVATE KEY-----';
const KEY_ID = "d7894431-525f-47bc-88b1-e22ae6cfb26f";
const CLIENT_WALLET_ADDRESS_URL = "https://ilp.interledger-test.dev/diego";

app.get("/api/productos", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM Pedido");
        res.json(rows);
    } catch (err) {
        console.error("❌ Error obteniendo pedidos de la BD:", err);
        res.status(500).json({ error: "Error al obtener los productos" });
    }
});

app.post("/api/iniciar-pago", async (req, res) => {
    const { transaccionId } = req.body;
    console.log('\n--- 🚀 INICIANDO PAGO para Transacción: ' + transaccionId + ' ---');

    try {
        console.log("1.1. Buscando transacción en la base de datos 'test'...");
        const [rows] = await pool.query("SELECT * FROM Pedido WHERE Transaccion = ?", [transaccionId]);

        if (!rows.length) {
            return res.status(404).json({ success: false, error: "Transacción no encontrada" });
        }
        const pedido = rows[0];
        const RECEIVING_WALLET_ADDRESS_URL = pedido.wallet_address_artesano.trim();
        const total = Number(pedido.Total);

        console.log("1.2. Creando cliente autenticado de Open Payments...");
        const client = await createAuthenticatedClient({ walletAddressUrl: CLIENT_WALLET_ADDRESS_URL, keyId: KEY_ID, privateKey: PRIVATE_KEY_PATH });

        console.log("1.3. Obteniendo wallets (emisora y receptora)... (Paso 1 del script)");
        const sendingWalletAddress = await client.walletAddress.get({ url: CLIENT_WALLET_ADDRESS_URL });
        const receivingWalletAddress = await client.walletAddress.get({ url: RECEIVING_WALLET_ADDRESS_URL });

        console.log("1.4. Solicitando grant para pago entrante... (Paso 2 del script)");
        const incomingPaymentGrant = await client.grant.request(
            { url: receivingWalletAddress.authServer },
            { access_token: { access: [{ type: "incoming-payment", actions: ["read", "create", "complete"] }] } }
        );
        if (!isFinalizedGrant(incomingPaymentGrant)) throw new Error("Incoming grant no finalizado");

        const valueUint64 = Math.round(total * Math.pow(10, receivingWalletAddress.assetScale));

        console.log("1.5. Creando pago entrante (incoming payment)... (Paso 3 del script)");
        const incomingPayment = await client.incomingPayment.create(
            { url: receivingWalletAddress.resourceServer, accessToken: incomingPaymentGrant.access_token.value },
            { walletAddress: receivingWalletAddress.id, incomingAmount: { assetCode: receivingWalletAddress.assetCode, assetScale: receivingWalletAddress.assetScale, value: valueUint64.toString() } }
        );

        console.log("1.6. Solicitando grant para cotización (quote)... (Paso 4 del script)");
        const quoteGrant = await client.grant.request(
            { url: sendingWalletAddress.authServer },
            { access_token: { access: [{ type: "quote", actions: ["create", "read"] }] } }
        );
        if (!isFinalizedGrant(quoteGrant)) throw new Error("Quote grant no finalizado");

        console.log("1.7. Creando cotización (quote)... (Paso 5 del script)");
        const quote = await client.quote.create(
            { url: sendingWalletAddress.resourceServer, accessToken: quoteGrant.access_token.value },
            { walletAddress: sendingWalletAddress.id, receiver: incomingPayment.id, method: "ilp" }
        );

        console.log("1.8. Solicitando grant interactivo para pago saliente... (Paso 6 del script)");
        const outgoingPaymentGrant = await client.grant.request(
            { url: sendingWalletAddress.authServer },
            {
                access_token: { access: [{ type: "outgoing-payment", actions: ["read", "create"], limits: { debitAmount: quote.debitAmount }, identifier: sendingWalletAddress.id }] },
                interact: { start: ["redirect"] }
            }
        );

        console.log("1.9. Devolviendo información de interacción al frontend.");
        res.json({
            success: true,
            interactUrl: outgoingPaymentGrant.interact.redirect,
            continueInfo: { uri: outgoingPaymentGrant.continue.uri, accessToken: outgoingPaymentGrant.continue.access_token.value },
            paymentInfo: { transaccionId: transaccionId, walletAddressId: sendingWalletAddress.id, quoteId: quote.id, resourceServer: sendingWalletAddress.resourceServer }
        });

    } catch (error) {
        console.error('❌ ERROR en /iniciar-pago para Transacción ' + transaccionId + ':', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/finalizar-pago", async (req, res) => {
    const { continueInfo, paymentInfo } = req.body;
    console.log('\n--- ✨ FINALIZANDO PAGO para Transacción: ' + paymentInfo.transaccionId + ' ---');

    try {
        const client = await createAuthenticatedClient({ walletAddressUrl: CLIENT_WALLET_ADDRESS_URL, keyId: KEY_ID, privateKey: PRIVATE_KEY_PATH });

        let finalizedOutgoingPaymentGrant;
        let grantError;

        console.log("2.1. Iniciando polling para verificar estado del grant... (Paso 7 del script)");
        for (let i = 0; i < 15; i++) {
            console.log('   - Intento de polling ' + (i + 1) + '/15...');
            try {
                const result = await client.grant.continue({ url: continueInfo.uri, accessToken: continueInfo.accessToken });

                // LÓGICA FINAL: Adaptada a la respuesta real del servidor
                // Un grant se considera aprobado si está finalizado Y tiene un access_token en el nivel superior.
                if (isFinalizedGrant(result)) {
                    if (result.access_token && result.access_token.value) {
                        console.log("   - ✅ Grant APROBADO (detectado por la presencia del access_token final).");
                        finalizedOutgoingPaymentGrant = result;
                    } else {
                        console.warn("   - ⚠️ Grant finalizado pero NO APROBADO (sin access_token final).");
                        grantError = 'El permiso de pago fue rechazado o cancelado por el usuario.';
                    }
                    break; // Salir del bucle, el grant está finalizado de una u otra forma.
                }
            } catch (err) {
                if (!(err instanceof OpenPaymentsClientError)) { throw err; }
                console.log("   - Grant aún no finalizado, reintentando en 2s...");
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (grantError) return res.status(400).json({ success: false, error: grantError });
        if (!finalizedOutgoingPaymentGrant) return res.status(408).json({ success: false, error: "Tiempo de espera para la autorización del pago agotado." });

        console.log('2.2. Creando pago saliente final con la cotización original: ' + paymentInfo.quoteId + ' (Paso 8 del script)');
        const outgoingPayment = await client.outgoingPayment.create(
            { url: paymentInfo.resourceServer, accessToken: finalizedOutgoingPaymentGrant.access_token.value },
            { walletAddress: paymentInfo.walletAddressId, quoteId: paymentInfo.quoteId }
        );

        console.log("2.3. Actualizando estado de la transacción en la base de datos a 'Completado'...");
        await pool.query("UPDATE Pedido SET status = 'completed' WHERE Transaccion = ?", [paymentInfo.transaccionId]);

        console.log("--- 🎉 PAGO COMPLETADO con éxito ---");
        res.json({ success: true, outgoingPaymentId: outgoingPayment.id });

    } catch (error) {
        console.error('❌ ERROR en /finalizar-pago para Transacción ' + paymentInfo.transaccionId + ':', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(3000, () => console.log("\nServidor corriendo en http://localhost:3000 y listo para recibir peticiones."));
