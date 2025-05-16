document.addEventListener('DOMContentLoaded', () => {
  const diaSelect = document.getElementById('diaSelect');
  const btnCarregar = document.getElementById('btnCarregar');
  const listaDiscursos = document.getElementById('listaDiscursos');
  const discursoAtualEl = document.getElementById('discursoAtual');
  const btnIniciar = document.getElementById('btnIniciar');
  const btnParar = document.getElementById('btnParar');
  const btnResetar = document.getElementById('btnResetar');
  const btnProximo = document.getElementById('btnProximo');
  const btnIncluir = document.getElementById('btnIncluir');
  const novoTemaInput = document.getElementById('novoTema');
  const novoTempoInput = document.getElementById('novoTempo');

  let discursos = [];
  let diaAtual = 'sabado';
  let estadoCronometro = {};

  // Conectar WebSocket para atualizações em tempo real
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const wsUrl = window.location.hostname === 'localhost' 
    ? 'ws://localhost:10000' 
    : `wss://cronometro-remoto-v2.onrender.com`;

  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.tipo === 'estado') {
    estadoCronometro = data.data;
    atualizarDiscursoAtual(data.data);
    
    // Força a atualização dos botões
    btnIniciar.disabled = !data.data.discursoAtual || data.data.ativo;
    btnParar.disabled = !data.data.discursoAtual || !data.data.ativo;
  }
}

  async function carregarDiscursos(dia) {
    try {
      const response = await fetch(`/api/discursos?dia=${dia}`);
      discursos = await response.json();
      renderizarLista();
      diaAtual = dia;
    } catch (err) {
      console.error('Erro ao carregar discursos:', err);
      alert('Erro ao carregar discursos');
    }
  }

  function renderizarLista() {
    listaDiscursos.innerHTML = '';
    discursos.forEach((discurso, index) => {
    const li = document.createElement('li');
    
    li.innerHTML = `
      <div class="disc-item-info">
        <span class="ordem">${index + 1}.</span>
        <span class="tema">${discurso.tema}</span>
        <span class="tempo">${discurso.tempo} min</span>
      </div>
      <div class="disc-item-actions">
        <button class="btn-start" data-id="${discurso.id}">▶</button>
        <button class="btn-move-up" data-id="${discurso.id}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-move-down" data-id="${discurso.id}" ${index === discursos.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn-remove" data-id="${discurso.id}">×</button>
      </div>
    `;
    
    listaDiscursos.appendChild(li);
  });

    // Adicione este novo event listener - iniciar
    document.querySelectorAll('.btn-start').forEach(btn => {
    btn.addEventListener('click', iniciarDiscursoSelecionado);
    });

    // Adicionar event listeners aos botões
    document.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', moverParaCima);
    });

    document.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', moverParaBaixo);
    });

    document.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', removerDiscurso);
    });
  }

  async function moverParaCima(e) {
    const id = parseInt(e.target.dataset.id);
    const index = discursos.findIndex(d => d.id === id);
    
    if (index > 0) {
      // Trocar posições
      [discursos[index], discursos[index - 1]] = [discursos[index - 1], discursos[index]];
      
      // Atualizar ordens
      discursos.forEach((d, i) => {
        d.ordem = i + 1;
      });
      
      try {
        await fetch('/api/discursos/ordem', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dia: diaAtual,
            novaOrdem: discursos.map(d => ({ id: d.id, ordem: d.ordem }))
          })
        });
        
        renderizarLista();
      } catch (err) {
        console.error('Erro ao mover discurso:', err);
        alert('Erro ao mover discurso');
      }
    }
  }

  async function moverParaBaixo(e) {
    const id = parseInt(e.target.dataset.id);
    const index = discursos.findIndex(d => d.id === id);
    
    if (index < discursos.length - 1) {
      // Trocar posições
      [discursos[index], discursos[index + 1]] = [discursos[index + 1], discursos[index]];
      
      // Atualizar ordens
      discursos.forEach((d, i) => {
        d.ordem = i + 1;
      });
      
      try {
        await fetch('/api/discursos/ordem', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dia: diaAtual,
            novaOrdem: discursos.map(d => ({ id: d.id, ordem: d.ordem }))
          })
        });
        
        renderizarLista();
      } catch (err) {
        console.error('Erro ao mover discurso:', err);
        alert('Erro ao mover discurso');
      }
    }
  }

  async function iniciarDiscursoSelecionado(e) {
  const id = parseInt(e.target.dataset.id);
  
  try {
    const response = await fetch('/api/cronometro/iniciar-item', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: id,
        dia: diaAtual
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao iniciar discurso');
    }

    const data = await response.json();
    console.log('Discurso iniciado:', data);
    
    // Atualizar interface
    atualizarDiscursoAtual({
      ativo: true,
      discursoAtual: data.discurso,
      tempoRestante: data.tempoRestante || data.discurso.tempo * 60,
      dia: diaAtual
    });

  } catch (err) {
    console.error('Erro ao iniciar discurso:', err);
    alert(`Erro: ${err.message}`);
  }
}

  async function removerDiscurso(e) {
    const id = parseInt(e.target.dataset.id);
    if (!confirm('Tem certeza que deseja remover este discurso?')) return;
    
    try {
      await fetch(`/api/discursos/${id}`, { method: 'DELETE' });
      discursos = discursos.filter(d => d.id !== id);
      renderizarLista();
    } catch (err) {
      console.error('Erro ao remover discurso:', err);
      alert('Erro ao remover discurso');
    }
  }

  function atualizarDiscursoAtual(estado) {
    const hasActiveDiscourse = estado.discursoAtual && estado.discursoAtual.id;
  
    if (hasActiveDiscourse) {
      const minutos = Math.floor(Math.abs(estado.tempoRestante) / 60);
      const segundos = Math.abs(estado.tempoRestante) % 60;
      const sinal = estado.tempoRestante < 0 ? '-' : '';
  
      discursoAtualEl.innerHTML = `
        <strong>Discurso Atual:</strong> ${estado.discursoAtual.tema}
        <br>
        <strong>Tempo Restante:</strong> ${sinal}${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}
        <br>
        <strong>Status:</strong> ${estado.ativo ? '▶ Em andamento' : '⏸ Pausado'}
      `;
    } else {
      discursoAtualEl.innerHTML = '<strong>Discurso Atual:</strong> Nenhum';
    }

    // Lógica CORRIGIDA dos botões:
    btnIniciar.disabled = !hasActiveDiscourse || estado.ativo;
    btnParar.disabled = !hasActiveDiscourse || !estado.ativo;
    btnResetar.disabled = !hasActiveDiscourse;
    btnProximo.disabled = !hasActiveDiscourse;
  }

  async function incluirDiscurso() {
    const tema = novoTemaInput.value.trim();
    const tempo = parseInt(novoTempoInput.value);
    
    if (!tema || isNaN(tempo) || tempo <= 0) {
      alert('Preencha todos os campos corretamente');
      return;
    }
    
    try {
      const novoDiscurso = {
        tema,
        tempo,
        ordem: discursos.length + 1,
        dia: diaAtual
      };
      
      const response = await fetch('/api/discursos/novo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoDiscurso)
      });
      
      const discursoAdicionado = await response.json();
      discursos.push(discursoAdicionado);
      renderizarLista();
      
      novoTemaInput.value = '';
      novoTempoInput.value = '';
    } catch (err) {
      console.error('Erro ao incluir discurso:', err);
      alert('Erro ao incluir discurso');
    }
  }

  async function resetarCronometro() {
  try {
    const response = await fetch('/api/cronometro/resetar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia: diaAtual })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Falha ao resetar');
    }
    
    console.log('Cronômetro resetado com sucesso');
  } catch (err) {
    console.error('Erro ao resetar cronômetro:', err);
    alert('Erro ao resetar cronômetro: ' + err.message);
  }
  }

  // Event Listeners
  btnCarregar.addEventListener('click', () => carregarDiscursos(diaSelect.value));
  btnIniciar.addEventListener('click', () => fetch('/api/cronometro/iniciar', { method: 'POST' }));
  btnParar.addEventListener('click', () => fetch('/api/cronometro/parar', { method: 'POST' }));
  btnProximo.addEventListener('click', () => fetch('/api/cronometro/proximo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dia: diaAtual })
  }));
  btnIncluir.addEventListener('click', incluirDiscurso);
  btnResetar.addEventListener('click', resetarCronometro);

  // Inicialização
  carregarDiscursos(diaAtual);
});