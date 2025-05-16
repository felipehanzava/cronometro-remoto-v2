document.addEventListener('DOMContentLoaded', () => {
  const temaInput = document.getElementById('tema');
  const tempoInput = document.getElementById('tempo');
  const diaSelect = document.getElementById('dia');
  const btnAdicionar = document.getElementById('btnAdicionar');
  const ulSabado = document.getElementById('ulSabado');
  const ulDomingo = document.getElementById('ulDomingo');
  const btnEnviar = document.getElementById('btnEnviar');

  let discursos = {
    sabado: [],
    domingo: []
  };

  // Carregar discursos do servidor
  async function carregarDiscursos() {
    try {
      const [sabadoRes, domingoRes] = await Promise.all([
        fetch('/api/discursos?dia=sabado'),
        fetch('/api/discursos?dia=domingo')
      ]);
      
      const sabado = await sabadoRes.json();
      const domingo = await domingoRes.json();
      
      discursos = {
        sabado: sabado || [],
        domingo: domingo || []
      };
      
      renderList();
    } catch (err) {
      console.error('Erro ao carregar discursos:', err);
      alert('Erro ao carregar discursos');
    }
  }

  // Renderizar listas
  function renderList() {
    ulSabado.innerHTML = '';
    ulDomingo.innerHTML = '';

    // Ordenar por ordem
    discursos.sabado.sort((a, b) => a.ordem - b.ordem);
    discursos.domingo.sort((a, b) => a.ordem - b.ordem);

    // Renderizar sábado
    discursos.sabado.forEach((d, i) => {
      const li = criarItemLista(d, i, 'sabado');
      ulSabado.appendChild(li);
    });

    // Renderizar domingo
    discursos.domingo.forEach((d, i) => {
      const li = criarItemLista(d, i, 'domingo');
      ulDomingo.appendChild(li);
    });
  }

  function criarItemLista(d, index, dia) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="disc-item-info">
        <strong>Ordem ${index + 1}:</strong> ${d.tema} - ${d.tempo} min
      </div>
      <div class="disc-item-actions">
        <button class="btn-move" data-action="up" data-id="${d.id}" data-dia="${dia}" ${index === 0 ? 'disabled' : ''}>⬆️</button>
        <button class="btn-move" data-action="down" data-id="${d.id}" data-dia="${dia}" ${index === discursos[dia].length - 1 ? 'disabled' : ''}>⬇️</button>
        <button class="btn-remove" data-id="${d.id}" data-dia="${dia}">X</button>
      </div>
    `;
    return li;
  }

  // Adicionar discurso
  btnAdicionar.addEventListener('click', () => {
    const tema = temaInput.value.trim();
    const tempo = parseInt(tempoInput.value);
    const dia = diaSelect.value;

    if (!tema) return alert('Tema obrigatório');
    if (isNaN(tempo) || tempo <= 0) return alert('Tempo válido obrigatório');

    const novoDiscurso = {
      tema,
      tempo,
      ordem: discursos[dia].length + 1,
      dia
    };

    discursos[dia].push(novoDiscurso);
    renderList();

    // Limpar campos
    temaInput.value = '';
    tempoInput.value = '';
  });

  // Manipular eventos de clique nos botões
  document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-remove')) {
      const id = e.target.dataset.id;
      const dia = e.target.dataset.dia;
      
      try {
        await fetch(`/api/discursos/${id}`, { method: 'DELETE' });
        discursos[dia] = discursos[dia].filter(d => d.id !== parseInt(id));
        renderList();
      } catch (err) {
        console.error('Erro ao remover discurso:', err);
        alert('Erro ao remover discurso');
      }
    }
    
    if (e.target.classList.contains('btn-move')) {
      const action = e.target.dataset.action;
      const id = parseInt(e.target.dataset.id);
      const dia = e.target.dataset.dia;
      
      const index = discursos[dia].findIndex(d => d.id === id);
      if (index === -1) return;
      
      if (action === 'up' && index > 0) {
        // Trocar com o anterior
        [discursos[dia][index], discursos[dia][index - 1]] = 
          [discursos[dia][index - 1], discursos[dia][index]];
      } else if (action === 'down' && index < discursos[dia].length - 1) {
        // Trocar com o próximo
        [discursos[dia][index], discursos[dia][index + 1]] = 
          [discursos[dia][index + 1], discursos[dia][index]];
      }
      
      // Atualizar ordens
      discursos[dia].forEach((d, i) => {
        d.ordem = i + 1;
      });
      
      renderList();
      
      // Enviar nova ordem para o servidor
      try {
        await fetch('/api/discursos/ordem', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dia,
            novaOrdem: discursos[dia].map(d => ({ id: d.id, ordem: d.ordem }))
          })
        });
      } catch (err) {
        console.error('Erro ao atualizar ordem:', err);
        alert('Erro ao atualizar ordem');
      }
    }
  });

  // Salvar no banco de dados
  btnEnviar.addEventListener('click', async () => {
  try {
    // Prepara os dados para envio
    const dadosParaEnviar = {
      sabado: discursos.sabado.map(d => ({
        tema: d.tema,
        tempo: d.tempo,
        ordem: d.ordem,
        dia: d.dia
      })),
      domingo: discursos.domingo.map(d => ({
        tema: d.tema,
        tempo: d.tempo,
        ordem: d.ordem,
        dia: d.dia
      }))
    };

    // Envia para o backend
    const response = await fetch('/api/salvar-discursos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dadosParaEnviar)
    });

    if (!response.ok) {
      throw new Error('Erro ao salvar no banco');
    }

    const result = await response.json();
    alert('Discursos salvos com sucesso!');
    console.log('Resposta do servidor:', result);
    
  } catch (error) {
    console.error('Erro ao salvar:', error);
    alert('Erro ao salvar discursos: ' + error.message);
  }
});


  // Inicializar
  carregarDiscursos();
});