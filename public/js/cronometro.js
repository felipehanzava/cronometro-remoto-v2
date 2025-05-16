document.addEventListener('DOMContentLoaded', () => {
  const tituloDiscurso = document.getElementById('tituloDiscurso');
  const cronometro = document.getElementById('cronometro');
  
  // Estado local para controle
  let estadoAtual = {
    ativo: false,
    tempoRestante: 0,
    discursoAtual: null
  };

  // Conectar WebSocket
  const wsUrl = window.location.hostname === 'localhost' 
    ? 'ws://localhost:10000' 
    : `wss://cronometro-remoto-v2.onrender.com`;

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Conectado ao servidor WebSocket');
  };

  ws.onerror = (error) => {
    console.error('Erro na conexão WebSocket:', error);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.tipo === 'estado') {
        estadoAtual = data.data;
        atualizarCronometro();
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  };

  function atualizarCronometro() {
  // Atualiza o título do discurso
  if (estadoAtual.discursoAtual) {
    tituloDiscurso.textContent = estadoAtual.discursoAtual.tema;
    
    // Formata o tempo (MM:SS) com suporte a negativos
    const minutos = Math.floor(Math.abs(estadoAtual.tempoRestante) / 60);
    const segundos = Math.abs(estadoAtual.tempoRestante) % 60;
    const sinal = estadoAtual.tempoRestante < 0 ? '-' : '';
    
    cronometro.textContent = `${sinal}${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

    // Muda a cor conforme o tempo
    if (estadoAtual.tempoRestante <= 0) {
      cronometro.style.color = '#ff0000';
      cronometro.classList.add('tempo-esgotado');
    } else if (estadoAtual.tempoRestante <= 10) {
      cronometro.style.color = '#ff4500';
      cronometro.classList.remove('tempo-esgotado');
    } else {
      cronometro.style.color = '#000000';
      cronometro.classList.remove('tempo-esgotado');
    }
  } else {
    tituloDiscurso.textContent = 'Nenhum discurso selecionado';
    cronometro.textContent = '00:00';
    cronometro.style.color = '#000000';
    cronometro.classList.remove('tempo-esgotado');
  }
}

  // Atualização inicial
  atualizarCronometro();
});