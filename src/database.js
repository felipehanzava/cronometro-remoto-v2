const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
    // Para Render, adicione:
    sslmode: 'require'
  },
  // Aumente os timeouts
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

// Criar tabela se não existir
async function criarTabela() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS discursos (
      id SERIAL PRIMARY KEY,
      tema TEXT NOT NULL,
      tempo INTEGER NOT NULL,
      ordem INTEGER NOT NULL,
      dia VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

// Operações CRUD
async function salvarListaDiscursos(dia, discursos) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM discursos WHERE dia = $1', [dia]);
    
    for (const discurso of discursos) {
      await client.query(
        'INSERT INTO discursos (tema, tempo, ordem, dia) VALUES ($1, $2, $3, $4)',
        [discurso.tema, discurso.tempo, discurso.ordem, dia]
      );
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function obterDiscursosPorDia(dia) {
  const res = await pool.query(
    'SELECT id, tema, tempo, ordem, dia FROM discursos WHERE dia = $1 ORDER BY ordem',
    [dia]
  );
  return res.rows;
}

async function adicionarDiscurso(discurso) {
  const res = await pool.query(
    'INSERT INTO discursos (tema, tempo, ordem, dia) VALUES ($1, $2, $3, $4) RETURNING *',
    [discurso.tema, discurso.tempo, discurso.ordem, discurso.dia]
  );
  return res.rows[0];
}

async function removerDiscurso(id) {
  await pool.query('DELETE FROM discursos WHERE id = $1', [id]);
}

async function atualizarOrdem(dia, novaOrdem) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const item of novaOrdem) {
      await client.query(
        'UPDATE discursos SET ordem = $1 WHERE id = $2 AND dia = $3',
        [item.ordem, item.id, dia]
      );
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  criarTabela,
  salvarListaDiscursos,
  obterDiscursosPorDia,
  adicionarDiscurso,
  removerDiscurso,
  atualizarOrdem
};