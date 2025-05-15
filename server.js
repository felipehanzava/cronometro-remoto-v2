const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { salvarLista, carregarLista } = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let fila = carregarLista();
let ativoIndex = null;
let tempoRestante = 0;
let timer = null;
let pausado = true;

function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

function iniciarCronometro() {
    if (ativoIndex === null || !fila[ativoIndex]) return;
    tempoRestante = fila[ativoIndex].tempo;
    pausado = false;

    if (timer) clearInterval(timer);
    timer = setInterval(() => {
        if (!pausado) {
            tempoRestante--;
            broadcast({ tipo: 'tempo', tempo: tempoRestante });
        }
    }, 1000);
}

function pararCronometro() {
    pausado = true;
}

function resetarCronometro() {
    if (ativoIndex !== null && fila[ativoIndex]) {
        tempoRestante = fila[ativoIndex].tempo;
        broadcast({ tipo: 'tempo', tempo: tempoRestante });
    }
}

function proximoDiscurso() {
    if (fila.length === 0) return;
    if (ativoIndex === null) {
        ativoIndex = 0;
    } else {
        ativoIndex++;
        if (ativoIndex >= fila.length) {
            ativoIndex = null;
            pararCronometro();
            broadcast({ tipo: 'tempo', tempo: 0 });
            return;
        }
    }
    iniciarCronometro();
    broadcast({ ativoIndex });
    broadcast({ tipo: 'tempo', tempo: tempoRestante });
}

wss.on('connection', ws => {
    ws.send(JSON.stringify({ tipo: 'fila', fila }));
    ws.send(JSON.stringify({ ativoIndex }));
    ws.send(JSON.stringify({ tipo: 'tempo', tempo: tempoRestante }));

    ws.on('message', message => {
        try {
            const msg = JSON.parse(message);

            if (msg.tema && msg.tempo) {
                fila.push(msg);
                if (ativoIndex === null) ativoIndex = 0;
                salvarLista(fila); 
                broadcast({ tipo: 'fila', fila });
                broadcast({ ativoIndex });
            }

            if (msg.tipo === 'fila' && Array.isArray(msg.fila)) {
                fila = msg.fila;
                salvarLista(fila); 
                broadcast({ tipo: 'fila', fila });
            }
        } catch (e) {
            // Comando simples (start, pause, reset, next)
            const cmd = message.toString();
            switch (cmd) {
                case 'start':
                    pausado = false;
                    break;
                case 'pause':
                    pararCronometro();
                    break;
                case 'reset':
                    resetarCronometro();
                    break;
                case 'next':
                    proximoDiscurso();
                    break;
            }
        }
    });
});

app.use(express.static(path.join(__dirname, 'public')));

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

