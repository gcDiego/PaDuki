import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import {
    createAuthenticatedClient,
    isFinalizedGrant
} from '@interledger/open-payments';

// --- CONFIGURACIÓN DE LA CONEXIÓN A MYSQL ---
const pool = mysql.createPool({
    host: 'localhost',
    user: 'admin',      // <-- RECUERDA RELLENAR ESTO
    password: '',  // <-- RECUERDA RELLENAR ESTO
    database: 'test',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log('✅ Piscina de conexiones a MySQL creada.');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'templates')));
app.use('/static', express.static(path.join(__dirname, 'static')));

const PORT = process.env.PORT || 3000;

// --- RUTAS ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.get('/cart', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'cart.html'));
});

app.post('/iniciar-pago', async (req, res) => {
    const { amount, items, currency } = req.body;

    if (!amount || !items || !items.length === 0) {
        return res.status(400).json({ error: 'El monto y los artículos son requeridos.' });
    }

    const transaccionId = `ORD-${Date.now()}`;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        console.log(`Iniciando inserción para Transacción ID: ${transaccionId}`);

        for (const item of items) {
            const query = `
                INSERT INTO Pedido (Transaccion, Producto, Cantidad, Total, wallet_address_artesano, status, Divisa)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const totalItem = (item.price / 100) * item.quantity;
            const values = [transaccionId, item.name, item.quantity, totalItem, item.wallet, 'pending', currency];
            await connection.execute(query, values);
        }

        await connection.commit();
        console.log('✅ Transacción completada y guardada en la base de datos.');

    } catch (dbError) {
        console.error('❌ Error durante la transacción con la base de datos:', dbError);
        if (connection) await connection.rollback();
        return res.status(500).json({ error: 'Error interno al procesar la orden.' });
    } finally {
        if (connection) connection.release();
    }

    try {
        const client = await createAuthenticatedClient({
            walletAddressUrl: CLIENT_WALLET_ADDRESS_URL,
            keyId: KEY_ID,
            privateKey: PRIVATE_KEY_PATH
        });

        const sendingWalletAddress = await client.walletAddress.get({ url: SENDING_WALLET_ADDRESS_URL });
        const receivingWalletAddress = await client.walletAddress.get({ url: RECEIVING_WALLET_ADDRESS_URL });

        const incomingPaymentGrant = await client.grant.request(
            { url: receivingWalletAddress.authServer },
            { access_token: { access: [{ type: 'incoming-payment', actions: ['read', 'complete', 'create'] }] } }
        );

        if (!isFinalizedGrant(incomingPaymentGrant)) throw new Error('Expected finalized incoming payment grant');

        const incomingPayment = await client.incomingPayment.create(
            { url: receivingWalletAddress.resourceServer, accessToken: incomingPaymentGrant.access_token.value },
            {
                walletAddress: receivingWalletAddress.id,
                incomingAmount: { assetCode: receivingWalletAddress.assetCode, assetScale: receivingWalletAddress.assetScale, value: amount.toString() },
                metadata: { transactionId: transaccionId }
            }
        );

        const quoteGrant = await client.grant.request(
            { url: sendingWalletAddress.authServer },
            { access_token: { access: [{ type: 'quote', actions: ['create', 'read'] }] } }
        );

        if (!isFinalizedGrant(quoteGrant)) throw new Error('Expected finalized quote grant');

        const quote = await client.quote.create(
            { url: sendingWalletAddress.resourceServer, accessToken: quoteGrant.access_token.value },
            { walletAddress: sendingWalletAddress.id, receiver: incomingPayment.id, method: 'ilp' }
        );

        const outgoingPaymentGrant = await client.grant.request(
            { url: sendingWalletAddress.authServer },
            {
                access_token: { access: [{ type: 'outgoing-payment', actions: ['read', 'create'], limits: { debitAmount: quote.debitAmount }, identifier: sendingWalletAddress.id }] },
                interact: { start: ['redirect'] }
            }
        );

        res.json({
            interactUrl: outgoingPaymentGrant.interact.redirect,
            continueInfo: { uri: outgoingPaymentGrant.continue.uri, accessToken: outgoingPaymentGrant.continue.access_token.value, transaccionId: transaccionId },
            paymentInfo: { quoteId: quote.id, walletAddressId: sendingWalletAddress.id }
        });

    } catch (error) {
        console.error('Error initiating payment:', error);
        res.status(500).json({ error: 'Failed to initiate payment.' });
    }
});

app.post('/finalizar-pago', async (req, res) => {
    const { continueInfo, paymentInfo } = req.body;
    if (!continueInfo || !paymentInfo) return res.status(400).json({ error: 'Missing continueInfo or paymentInfo' });

    try {
        const client = await createAuthenticatedClient({ walletAddressUrl: CLIENT_WALLET_ADDRESS_URL, keyId: KEY_ID, privateKey: PRIVATE_KEY_PATH });

        const grant = await client.grant.continue({ url: continueInfo.uri, accessToken: continueInfo.accessToken });

        if (!isFinalizedGrant(grant)) {
            return res.status(408).json({ error: 'Payment authorization not yet granted.' });
        }

        const outgoingPayment = await client.outgoingPayment.create(
            { url: (await client.walletAddress.get({ url: SENDING_WALLET_ADDRESS_URL })).resourceServer, accessToken: grant.access_token.value },
            { walletAddress: paymentInfo.walletAddressId, quoteId: paymentInfo.quoteId }
        );

        try {
            const updateQuery = "UPDATE Pedido SET status = ? WHERE Transaccion = ?";
            await pool.execute(updateQuery, ['pending', continueInfo.transaccionId]);
            console.log(`✅ Estado de la transacción ${continueInfo.transaccionId} actualizado a 'completed'.`);
        } catch (dbError) {
            console.error('❌ Error al actualizar el estado en la base de datos:', dbError);
        }

        res.json({ success: true, paymentId: outgoingPayment.id });

    } catch (error) {
        if (error.status === 401) {
            return res.status(408).json({ error: 'Payment authorization not yet granted.' });
        }
        console.error('Error finalizing payment:', error);
        res.status(500).json({ error: 'Failed to finalize payment.' });
    }
});

// --- CONFIGURACIÓN DE CLIENTE ---
const PRIVATE_KEY_PATH = path.join(__dirname, 'private.key');
const KEY_ID = 'd7894431-525f-47bc-88b1-e22ae6cfb26f';
const CLIENT_WALLET_ADDRESS_URL = 'https://ilp.interledger-test.dev/diego';
const SENDING_WALLET_ADDRESS_URL = 'https://ilp.interledger-test.dev/diego';
const RECEIVING_WALLET_ADDRESS_URL = 'https://ilp.interledger-test.dev/paduki';

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
