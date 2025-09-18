// db.js
import mysql from 'mysql2/promise';

// Configura la piscina de conexiones a tu base de datos MySQL.
// Usamos una piscina para manejar las conexiones de forma más eficiente.
export const pool = mysql.createPool({
    host: 'localhost',
    user: 'admin',      // Tu usuario de la base de datos
    password: '',  // Tu contraseña de la base de datos
    database: 'test',     // El nombre de tu base de datos
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Imprimimos un mensaje para confirmar que la configuración se ha cargado.
console.log('✅ Módulo db.js cargado: Piscina de conexiones a MySQL configurada.');
