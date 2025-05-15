const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.resolve(__dirname, 'data.sqlite'));

// Criar tabela se não existir
db.prepare(`
  CREATE TABLE IF NOT EXISTS discursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tema TEXT NOT NULL,
    tempo INTEGER NOT NULL,
    ordem INTEGER NOT NULL
  )
`).run();

// Função para salvar lista completa (limpa e insere tudo)
function salvarLista(discursos) {
  const deleteAll = db.prepare(`DELETE FROM discursos`);
  deleteAll.run();

  const insert = db.prepare(`
    INSERT INTO discursos (tema, tempo, ordem)
    VALUES (?, ?, ?)
  `);

  const insertMany = db.transaction((lista) => {
    lista.forEach((d, i) => {
      insert.run(d.tema, d.tempo, i);
    });
  });

  insertMany(discursos);
}

// Função para carregar lista ordenada
function carregarLista() {
  const stmt = db.prepare(`SELECT tema, tempo FROM discursos ORDER BY ordem`);
  return stmt.all();
}

module.exports = {
  salvarLista,
  carregarLista,
};
