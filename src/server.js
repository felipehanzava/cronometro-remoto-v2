require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');
const { criarTabela, obterDiscursosPorDia, salvarListaDiscursos, adicionarDiscurso, removerDiscurso, atualizarOrdem } = require('./database');

const app = express();
const server = http.createServer(app);
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ server });

// Configuração do PostgreSQL (adicione isso se não estiver no database.js)
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false,
    ca: process.env.DB_CA_CERT ? Buffer.from(process.env.DB_CA_CERT, 'base64').toString('ascii') : undefined
  },
  connectionTimeoutMillis: 5000, // 5 segundos
  idleTimeoutMillis: 30000,
  max: 20
});

// Estado do cronômetro
let estadoCronometro = {
  ativo: false,
  tempoRestante: 0,
  discursoAtual: null,
  dia: 'sabado'
};

let timer = null; // Mantemos o timer separado para evitar referência circular

// WebSocket para atualizações em tempo real
wss.on('connection', (ws) => {
  // Envia o estado atual imediatamente ao conectar
   console.log('Nova conexão WebSocket recebida')
  ws.send(JSON.stringify({
    tipo: 'estado',
    data: {
      ativo: estadoCronometro.ativo,
      tempoRestante: estadoCronometro.tempoRestante,
      discursoAtual: estadoCronometro.discursoAtual,
      dia: estadoCronometro.dia
    }
  }));

  ws.on('error', (err) => {
    console.error('Erro no WebSocket:', err);
  });

  // Adicione este handler para conexões fechadas
  ws.on('close', () => {
    console.log('Conexão WebSocket fechada');
  });
});

function broadcastEstado() {
  const estadoParaEnviar = {
    ativo: estadoCronometro.ativo,
    tempoRestante: estadoCronometro.tempoRestante,
    discursoAtual: estadoCronometro.discursoAtual,
    dia: estadoCronometro.dia
  };

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({
          tipo: 'estado',
          data: estadoParaEnviar
        }));
      } catch (err) {
        console.error('Erro ao enviar estado via WebSocket:', err);
      }
    }
  });
}


function iniciarContagemRegressiva() {
 if (timer) {
    clearInterval(timer);
    timer = null;
  }
  
  timer = setInterval(() => {
    estadoCronometro.tempoRestante--;
    broadcastEstado();
    
    // Opcional: parar após um limite muito negativo
    if (estadoCronometro.tempoRestante < -3600) {
      clearInterval(timer);
      timer = null;
    }
  }, 1000);
}

// Middleware para log de requisições
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Rotas estáticas
// Configuração CORRETA para arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Rotas para cada página (adicione estas linhas)
app.get('/cronometro', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/cronometro.html'));
});

app.get('/controle', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/controle.html'));
});

app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/cadastro.html'));
});


// Rotas API
app.get('/api/discursos', async (req, res) => {
  try {
    const { dia } = req.query;
    const discursos = await obterDiscursosPorDia(dia);
    res.json(discursos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/discursos', async (req, res) => {
  try {
    const { dia, discursos } = req.body;
    await salvarListaDiscursos(dia, discursos);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/discursos/novo', async (req, res) => {
  try {
    const discurso = await adicionarDiscurso(req.body);
    res.json(discurso);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/discursos/:id', async (req, res) => {
  try {
    await removerDiscurso(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/discursos/ordem', async (req, res) => {
  try {
    const { dia, novaOrdem } = req.body;
    await atualizarOrdem(dia, novaOrdem);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cronometro/iniciar', (req, res) => {
   if (!estadoCronometro.discursoAtual) {
    return res.status(400).json({ error: 'Nenhum discurso selecionado' });
  }
  
  estadoCronometro.ativo = true;
  iniciarContagemRegressiva();
  res.json({ success: true });
});

app.post('/api/cronometro/parar', (req, res) => {
   try {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    
    estadoCronometro.ativo = false;
    broadcastEstado();
    
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao parar cronômetro:', err);
    res.status(500).json({ error: 'Erro ao parar cronômetro' });
  }
});

app.post('/api/cronometro/resetar', (req, res) => {
   try {
    // Parar o timer se estiver ativo
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    // Resetar o tempo para o valor original do discurso atual
    if (estadoCronometro.discursoAtual) {
      estadoCronometro.tempoRestante = estadoCronometro.discursoAtual.tempo * 60;
      estadoCronometro.ativo = false;
      broadcastEstado();
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Nenhum discurso ativo para resetar' });
    }
  } catch (err) {
    console.error('Erro ao resetar cronômetro:', err);
    res.status(500).json({ error: 'Erro ao resetar cronômetro' });
  }
});

app.post('/api/cronometro/proximo', async (req, res) => {
  try {
    const { dia } = req.body;
    const discursos = await obterDiscursosPorDia(dia);
    
    if (!estadoCronometro.discursoAtual) {
      estadoCronometro.discursoAtual = discursos[0];
      estadoCronometro.tempoRestante = discursos[0].tempo * 60;
    } else {
      const indexAtual = discursos.findIndex(d => d.id === estadoCronometro.discursoAtual.id);
      if (indexAtual < discursos.length - 1) {
        estadoCronometro.discursoAtual = discursos[indexAtual + 1];
        estadoCronometro.tempoRestante = discursos[indexAtual + 1].tempo * 60;
      }
    }
    
    estadoCronometro.dia = dia;
    estadoCronometro.ativo = false; // 👈 Garante que começa PAUSADO
    broadcastEstado();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cronometro/iniciar-item', express.json(), async (req, res) => {
  try {
    const { id, dia } = req.body;
    
    if (!id || !dia) {
      return res.status(400).json({ error: 'ID e dia são obrigatórios' });
    }

    const discursos = await obterDiscursosPorDia(dia);
    const discursoSelecionado = discursos.find(d => d.id === id);

    if (!discursoSelecionado) {
      return res.status(404).json({ error: 'Discurso não encontrado' });
    }

    // Parar o timer atual se estiver rodando
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    // Atualizar estado
    estadoCronometro = {
      ativo: true,
      tempoRestante: discursoSelecionado.tempo * 60,
      discursoAtual: discursoSelecionado,
      dia
    };

    // Iniciar novo timer
    iniciarContagemRegressiva();
    
    // Broadcast do novo estado
    broadcastEstado();
    
    res.json({ 
      success: true, 
      discurso: discursoSelecionado,
      tempoRestante: estadoCronometro.tempoRestante
    });
    
  } catch (err) {
    console.error('Erro ao iniciar item:', err);
    res.status(500).json({ error: 'Erro interno ao iniciar discurso' });
  }
});

app.post('/api/salvar-discursos', express.json(), async (req, res) => {
  try {
    const { sabado, domingo } = req.body;

    if (!sabado || !domingo) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Salva os discursos de sábado
    await salvarListaDiscursos('sabado', sabado);
    
    // Salva os discursos de domingo
    await salvarListaDiscursos('domingo', domingo);

    res.json({ success: true, message: 'Discursos salvos com sucesso' });
  } catch (err) {
    console.error('Erro ao salvar discursos:', err);
    res.status(500).json({ error: 'Erro ao salvar discursos' });
  }
});

// Iniciar servidor
async function iniciarServidor() {
  try {
    await criarTabela();
    await pool.query('SELECT 1'); // Testa a conexão com o banco
    server.listen(process.env.PORT || 10000, () => {
      console.log(`Servidor rodando na porta ${process.env.PORT || 10000}`);
    });
  } catch (err) {
    console.error('Erro ao iniciar servidor:', err);
    process.exit(1);
  }
}

iniciarServidor();