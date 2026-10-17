/**
 * vChat Maker Messenger Pro - Frontend
 * Aplicación completa de creación de videos de chat ficticios
 */

(function () {
  'use strict';

  // ========== ESTADO GLOBAL ==========
  const state = {
    personajes: [],
    mensajes: [],
    editingPersonajeId: null,
    editingMensajeId: null,
    voces: [],
    fondoUrl: null,
    fondoFile: null,
    audioMap: {}, // mensajeId -> audioUrl
    isPlaying: false,
    playAbort: null,
    titulo: '',
    resumen: ''
  };

  // ========== UTILIDADES ==========
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function uid() {
    return 'id_' + Math.random().toString(36).slice(2, 11);
  }

  function toast(msg, type = 'info') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 3500);
  }

  function showLoading(text = 'Procesando...') {
    $('#loadingText').textContent = text;
    $('#loadingOverlay').classList.remove('hidden');
  }

  function hideLoading() {
    $('#loadingOverlay').classList.add('hidden');
  }

  async function api(url, options = {}) {
    const opts = {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    };
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.body = JSON.stringify(opts.body);
    }
    if (opts.body instanceof FormData) {
      delete opts.headers['Content-Type'];
    }
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Error del servidor');
      err.status = res.status;
      err.code = data.code;
      throw err;
    }
    return data;
  }

  // ========== NAVEGACIÓN ==========
  function initNav() {
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.nav-btn').forEach(b => b.classList.remove('active'));
        $$('.section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        const sec = btn.dataset.section;
        $(`#section-${sec}`).classList.add('active');
        if (sec === 'preview') updatePreviewStatic();
        if (sec === 'exportar') updateExportInfo();
      });
    });
  }

  // ========== PERSONAJES ==========
  function renderPersonajes() {
    const list = $('#personajesList');
    const empty = $('#personajesEmpty');
    list.innerHTML = '';

    if (state.personajes.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    state.personajes.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'personaje-card';
      const avatarHtml = p.foto
        ? `<img class="avatar" src="${p.foto}" alt="${p.nombre}" />`
        : `<div class="avatar-placeholder">${(p.nombre || '?')[0].toUpperCase()}</div>`;
      const vozName = state.voces.find(v => v.voice_id === p.voice_id)?.name || (p.voice_id ? 'Voz asignada' : 'Sin voz');
      card.innerHTML = `
        ${avatarHtml}
        <div class="name">${escapeHtml(p.nombre)}</div>
        <div class="voice-name">${escapeHtml(vozName)}</div>
        <div class="actions">
          <button data-action="edit" data-id="${p.id}">Editar</button>
          <button data-action="up" data-id="${p.id}" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button data-action="down" data-id="${p.id}" ${idx === state.personajes.length - 1 ? 'disabled' : ''}>↓</button>
          <button data-action="del" data-id="${p.id}">Eliminar</button>
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'edit') openModalPersonaje(id);
        else if (action === 'del') {
          if (confirm('¿Eliminar este personaje?')) {
            state.personajes = state.personajes.filter(p => p.id !== id);
            renderPersonajes();
          }
        } else if (action === 'up' || action === 'down') {
          const i = state.personajes.findIndex(p => p.id === id);
          const j = action === 'up' ? i - 1 : i + 1;
          if (j >= 0 && j < state.personajes.length) {
            [state.personajes[i], state.personajes[j]] = [state.personajes[j], state.personajes[i]];
            renderPersonajes();
          }
        }
      });
    });
  }

  function openModalPersonaje(id = null) {
    state.editingPersonajeId = id;
    const modal = $('#modalPersonaje');
    $('#modalPersonajeTitle').textContent = id ? 'Editar personaje' : 'Nuevo personaje';
    const p = id ? state.personajes.find(x => x.id === id) : null;
    $('#pjNombre').value = p?.nombre || '';
    $('#pjColor').value = p?.color || '#7c3aed';
    $('#pjVoz').value = p?.voice_id || '';
    const prev = $('#pjFotoPreview');
    if (p?.foto) {
      prev.style.backgroundImage = `url(${p.foto})`;
      prev.dataset.url = p.foto;
    } else {
      prev.style.backgroundImage = '';
      prev.dataset.url = '';
    }
    modal.classList.remove('hidden');
  }

  function closeModalPersonaje() {
    $('#modalPersonaje').classList.add('hidden');
    state.editingPersonajeId = null;
  }

  function savePersonaje() {
    const nombre = $('#pjNombre').value.trim();
    if (!nombre) {
      toast('Escribe un nombre para el personaje', 'error');
      return;
    }
    const foto = $('#pjFotoPreview').dataset.url || null;
    const voice_id = $('#pjVoz').value || null;
    const color = $('#pjColor').value || '#7c3aed';

    if (state.editingPersonajeId) {
      const p = state.personajes.find(x => x.id === state.editingPersonajeId);
      if (p) {
        p.nombre = nombre;
        p.foto = foto;
        p.voice_id = voice_id;
        p.color = color;
      }
    } else {
      state.personajes.push({
        id: uid(),
        nombre,
        foto,
        voice_id,
        color
      });
    }
    closeModalPersonaje();
    renderPersonajes();
    toast('Personaje guardado', 'success');
  }

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al subir');
    return data.url;
  }

  // ========== VOCES ==========
  async function loadVoces() {
    try {
      const data = await api('/api/voices/list');
      state.voces = data.voices || [];
      const sel = $('#pjVoz');
      const current = sel.value;
      sel.innerHTML = '<option value="">— Selecciona una voz —</option>';
      state.voces.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.voice_id;
        opt.textContent = v.name + (v.category ? ` (${v.category})` : '');
        sel.appendChild(opt);
      });
      if (current) sel.value = current;
      toast(`Se cargaron ${state.voces.length} voces`, 'success');
    } catch (err) {
      toast(err.message || 'No se pudieron cargar las voces', 'error');
    }
  }

  // ========== HISTORIA ==========
  function initTabs() {
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach(t => t.classList.remove('active'));
        $$('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        $(`#tab-${tab.dataset.tab}`).classList.add('active');
      });
    });
  }

  async function generarHistoria(modo) {
    if (state.personajes.length < 2) {
      toast('Necesitas al menos 2 personajes', 'error');
      return;
    }

    showLoading('Generando historia con IA...');
    try {
      const body = {
        modo,
        personajes: state.personajes.map(p => ({ nombre: p.nombre })),
        genero: $('#genero')?.value || 'drama',
        tema: $('#tema')?.value || '',
        tono: $('#tono')?.value || 'serio',
        final: $('#final')?.value || 'abierto',
        duracion: modo === 'propia' ? $('#duracionPropia').value : $('#duracion').value,
        ideaUsuario: modo === 'propia' ? $('#ideaUsuario').value : ''
      };

      const data = await api('/api/ai/generate-story', { method: 'POST', body });
      state.titulo = data.titulo || '';
      state.resumen = data.resumen || '';
      state.mensajes = (data.mensajes || []).map(m => ({
        id: uid(),
        personaje: m.personaje,
        texto: m.texto
      }));
      state.audioMap = {};

      $('#historiaTitulo').textContent = state.titulo;
      $('#historiaResumen').textContent = state.resumen;
      $('#historiaResultado').classList.remove('hidden');
      renderMensajes();
      toast('Historia generada', 'success');
    } catch (err) {
      toast(err.message || 'Error al generar historia', 'error');
    } finally {
      hideLoading();
    }
  }

  // ========== MENSAJES ==========
  function renderMensajes() {
    const list = $('#mensajesList');
    const empty = $('#mensajesEmpty');
    list.innerHTML = '';

    if (state.mensajes.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    state.mensajes.forEach((m, idx) => {
      const pj = state.personajes.find(p => p.nombre === m.personaje);
      const item = document.createElement('div');
      item.className = 'mensaje-item';
      const avatar = pj?.foto
        ? `<img class="msg-avatar" src="${pj.foto}" alt="" />`
        : `<div class="msg-avatar-ph">${(m.personaje || '?')[0].toUpperCase()}</div>`;
      item.innerHTML = `
        ${avatar}
        <div class="msg-body">
          <div class="msg-name">${escapeHtml(m.personaje)}</div>
          <div class="msg-text">${escapeHtml(m.texto)}</div>
        </div>
        <div class="msg-actions">
          <button data-a="edit" data-id="${m.id}">Editar</button>
          <button data-a="up" data-id="${m.id}" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button data-a="down" data-id="${m.id}" ${idx === state.mensajes.length - 1 ? 'disabled' : ''}>↓</button>
          <button data-a="del" data-id="${m.id}">✕</button>
        </div>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const a = btn.dataset.a;
        if (a === 'edit') openModalMensaje(id);
        else if (a === 'del') {
          state.mensajes = state.mensajes.filter(m => m.id !== id);
          delete state.audioMap[id];
          renderMensajes();
        } else if (a === 'up' || a === 'down') {
          const i = state.mensajes.findIndex(m => m.id === id);
          const j = a === 'up' ? i - 1 : i + 1;
          if (j >= 0 && j < state.mensajes.length) {
            [state.mensajes[i], state.mensajes[j]] = [state.mensajes[j], state.mensajes[i]];
            renderMensajes();
          }
        }
      });
    });
  }

  function openModalMensaje(id = null) {
    state.editingMensajeId = id;
    const modal = $('#modalMensaje');
    $('#modalMensajeTitle').textContent = id ? 'Editar mensaje' : 'Nuevo mensaje';
    const sel = $('#msgPersonaje');
    sel.innerHTML = '';
    state.personajes.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.nombre;
      opt.textContent = p.nombre;
      sel.appendChild(opt);
    });
    if (id) {
      const m = state.mensajes.find(x => x.id === id);
      if (m) {
        sel.value = m.personaje;
        $('#msgTexto').value = m.texto;
      }
    } else {
      $('#msgTexto').value = '';
      if (state.personajes[0]) sel.value = state.personajes[0].nombre;
    }
    modal.classList.remove('hidden');
  }

  function closeModalMensaje() {
    $('#modalMensaje').classList.add('hidden');
    state.editingMensajeId = null;
  }

  function saveMensaje() {
    const personaje = $('#msgPersonaje').value;
    const texto = $('#msgTexto').value.trim();
    if (!texto) {
      toast('Escribe el texto del mensaje', 'error');
      return;
    }
    if (state.editingMensajeId) {
      const m = state.mensajes.find(x => x.id === state.editingMensajeId);
      if (m) {
        m.personaje = personaje;
        m.texto = texto;
        delete state.audioMap[m.id];
      }
    } else {
      state.mensajes.push({ id: uid(), personaje, texto });
    }
    closeModalMensaje();
    renderMensajes();
    toast('Mensaje guardado', 'success');
  }

  async function regenerarMensaje() {
    const personaje = $('#msgPersonaje').value;
    const contexto = state.mensajes.slice(0, 8).map(m => `${m.personaje}: ${m.texto}`).join('\n');
    showLoading('Regenerando mensaje...');
    try {
      const data = await api('/api/ai/regenerate-message', {
        method: 'POST',
        body: { personaje, contexto, tono: 'natural' }
      });
      $('#msgTexto').value = data.texto || '';
      toast('Mensaje regenerado', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  // ========== PREVIEW ==========
  function updatePreviewStatic() {
    // Fondo
    const bg = $('#bgLayer');
    if (state.fondoUrl) {
      bg.style.backgroundImage = `url(${state.fondoUrl})`;
      bg.style.backgroundSize = 'cover';
    } else {
      bg.style.backgroundImage = '';
      bg.style.background = 'linear-gradient(160deg, #1a0a2e 0%, #0f0a1a 40%, #1a1030 100%)';
    }
    const osc = Number($('#fondoOscurecer').value) / 100;
    $('#bgOverlay').style.background = `rgba(0,0,0,${osc})`;
    $('#fondoOscurecerVal').textContent = $('#fondoOscurecer').value + '%';

    // Tamaño chat
    const size = $('#chatSize').value;
    $('#chatWindow').style.width = size + '%';
    $('#chatSizeVal').textContent = size + '%';

    // Watermark
    const wm = $('#watermarkEl');
    wm.textContent = $('#watermarkText').value || '';
    wm.style.opacity = Number($('#watermarkOpacity').value) / 100;
    wm.className = 'watermark ' + ($('#watermarkPos').value || 'bottom-right');

    // Mensajes estáticos
    renderChatBubbles(false);
  }

  function renderChatBubbles(animate = false) {
    const container = $('#chatMessages');
    container.innerHTML = '';
    // Determinar "own" = segundo personaje o el que más mensajes tiene al final
    const names = state.personajes.map(p => p.nombre);
    const rightName = names[1] || names[0];

    state.mensajes.forEach((m, i) => {
      const pj = state.personajes.find(p => p.nombre === m.personaje);
      const isOwn = m.personaje === rightName;
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble' + (isOwn ? ' own' : '');
      bubble.dataset.idx = i;
      const av = pj?.foto
        ? `<img class="bubble-avatar" src="${pj.foto}" alt="" />`
        : `<div class="bubble-avatar-ph">${(m.personaje || '?')[0].toUpperCase()}</div>`;
      bubble.innerHTML = `
        ${av}
        <div>
          <div class="bubble-name">${escapeHtml(m.personaje)}</div>
          <div class="bubble-content">${escapeHtml(m.texto)}</div>
        </div>
      `;
      if (!animate) bubble.classList.add('visible');
      container.appendChild(bubble);
    });
    container.scrollTop = container.scrollHeight;
  }

  async function playPreview() {
    if (state.mensajes.length === 0) {
      toast('No hay mensajes para previsualizar', 'error');
      return;
    }
    if (state.isPlaying) return;
    state.isPlaying = true;
    const abort = { stopped: false };
    state.playAbort = abort;

    renderChatBubbles(true);
    const bubbles = $$('#chatMessages .chat-bubble');
    const progress = $('#previewProgress');
    const fill = $('#previewProgressFill');
    const text = $('#previewProgressText');
    progress.classList.remove('hidden');

    for (let i = 0; i < state.mensajes.length; i++) {
      if (abort.stopped) break;
      const bubble = bubbles[i];
      if (bubble) {
        bubble.classList.add('visible');
        bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Reproducir audio si existe
      const audioUrl = state.audioMap[state.mensajes[i].id];
      let duration = Math.max(1500, state.mensajes[i].texto.length * 60);
      if (audioUrl) {
        try {
          const audio = new Audio(audioUrl);
          await new Promise((resolve) => {
            audio.onended = resolve;
            audio.onerror = resolve;
            audio.play().catch(resolve);
            // Timeout de seguridad
            setTimeout(resolve, 15000);
          });
          duration = 400;
        } catch (e) { /* ignore */ }
      } else {
        await sleep(duration);
      }

      const pct = Math.round(((i + 1) / state.mensajes.length) * 100);
      fill.style.width = pct + '%';
      text.textContent = pct + '%';
    }

    state.isPlaying = false;
    progress.classList.add('hidden');
  }

  function stopPreview() {
    if (state.playAbort) state.playAbort.stopped = true;
    state.isPlaying = false;
    $('#previewProgress').classList.add('hidden');
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ========== VOCES BATCH ==========
  async function generarVoces() {
    if (state.mensajes.length === 0) {
      toast('No hay mensajes', 'error');
      return;
    }
    const voiceMap = {};
    let missing = false;
    state.personajes.forEach(p => {
      if (p.voice_id) voiceMap[p.nombre] = p.voice_id;
      else missing = true;
    });
    if (missing || Object.keys(voiceMap).length === 0) {
      toast('Asigna una voz a cada personaje en la sección Personajes', 'error');
      return;
    }

    showLoading('Generando voces con ElevenLabs...');
    try {
      const data = await api('/api/voices/generate-batch', {
        method: 'POST',
        body: {
          mensajes: state.mensajes.map(m => ({ id: m.id, texto: m.texto, personaje: m.personaje })),
          voiceMap
        }
      });
      let ok = 0;
      (data.results || []).forEach(r => {
        if (r.success && r.audioUrl) {
          state.audioMap[r.id] = r.audioUrl;
          ok++;
        }
      });
      toast(`Voces generadas: ${ok}/${state.mensajes.length}`, ok > 0 ? 'success' : 'error');
      updateExportInfo();
    } catch (err) {
      toast(err.message || 'Error al generar voces', 'error');
    } finally {
      hideLoading();
    }
  }

  // ========== EXPORTAR ==========
  function updateExportInfo() {
    const dur = $('#duracion')?.value || $('#duracionPropia')?.value || '1:30';
    $('#exportDuracion').textContent = dur;
    $('#exportMensajesCount').textContent = state.mensajes.length;
    const hasAudio = Object.keys(state.audioMap).length > 0;
    $('#exportVocesStatus').textContent = hasAudio
      ? `${Object.keys(state.audioMap).length} audios`
      : 'Pendiente (opcional)';
  }

  async function exportVideo() {
    if (state.mensajes.length === 0) {
      toast('No hay mensajes para exportar', 'error');
      return;
    }

    const progress = $('#exportProgress');
    const fill = $('#exportProgressFill');
    const text = $('#exportProgressText');
    progress.classList.remove('hidden');
    fill.style.width = '5%';
    text.textContent = 'Preparando canvas...';

    try {
      // Usar el video-frame como base, capturar con canvas + MediaRecorder
      const frame = $('#videoFrame');
      const rect = frame.getBoundingClientRect();
      const scale = 2; // para mejor calidad
      const w = 1080;
      const h = 1920;

      // Crear canvas offscreen
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      // Stream del canvas
      const stream = canvas.captureStream(30);
      // Añadir audio si hay
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      const audioTracks = dest.stream.getAudioTracks();
      audioTracks.forEach(t => stream.addTrack(t));

      let recorder;
      const chunks = [];
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm'
        });
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const done = new Promise(resolve => {
        recorder.onstop = () => resolve();
      });

      recorder.start(100);
      fill.style.width = '15%';
      text.textContent = 'Grabando...';

      // Resetear burbujas
      renderChatBubbles(true);
      updatePreviewStatic();

      // Dibujar frames
      const total = state.mensajes.length;
      for (let i = 0; i < total; i++) {
        // Mostrar burbuja
        const bubbles = $$('#chatMessages .chat-bubble');
        if (bubbles[i]) {
          bubbles[i].classList.add('visible');
          bubbles[i].scrollIntoView({ block: 'nearest' });
        }

        // Reproducir audio y dibujar durante ese tiempo
        const audioUrl = state.audioMap[state.mensajes[i].id];
        let waitMs = Math.max(1200, state.mensajes[i].texto.length * 55);

        if (audioUrl) {
          try {
            const audio = new Audio(audioUrl);
            const source = audioCtx.createMediaElementSource(audio);
            source.connect(dest);
            source.connect(audioCtx.destination);
            await new Promise(resolve => {
              audio.onended = resolve;
              audio.onerror = resolve;
              audio.play().catch(resolve);
              setTimeout(resolve, 12000);
            });
            waitMs = 300;
          } catch (e) {
            await sleep(waitMs);
          }
        } else {
          // Dibujar varios frames durante la espera
          const steps = Math.ceil(waitMs / 50);
          for (let s = 0; s < steps; s++) {
            await drawFrameToCanvas(ctx, w, h);
            await sleep(50);
          }
          waitMs = 0;
        }

        // Un frame extra
        await drawFrameToCanvas(ctx, w, h);
        if (waitMs > 0) await sleep(waitMs);

        const pct = 15 + Math.round(((i + 1) / total) * 70);
        fill.style.width = pct + '%';
        text.textContent = `Mensaje ${i + 1}/${total}`;
      }

      // Unos frames finales
      for (let i = 0; i < 15; i++) {
        await drawFrameToCanvas(ctx, w, h);
        await sleep(40);
      }

      fill.style.width = '90%';
      text.textContent = 'Finalizando...';
      recorder.stop();
      await done;

      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      $('#exportResult').classList.remove('hidden');
      const video = $('#exportVideoPreview');
      video.src = url;
      const link = $('#downloadLink');
      link.href = url;
      link.download = 'vchat-' + Date.now() + '.webm';
      // Nota: muchos móviles convierten webm o lo abren. Para MP4 puro haría falta FFmpeg en servidor.

      fill.style.width = '100%';
      text.textContent = '¡Listo!';
      toast('Video generado. Puedes descargarlo.', 'success');

      setTimeout(() => progress.classList.add('hidden'), 2000);
    } catch (err) {
      console.error(err);
      toast('Error al exportar: ' + (err.message || 'desconocido'), 'error');
      progress.classList.add('hidden');
    }
  }

  async function drawFrameToCanvas(ctx, w, h) {
    // Dibujar el video-frame escalado al canvas
    // Usamos html2canvas-like approach simple: dibujar fondo + chat aproximado
    // Para mejor fidelidad, usamos el elemento real con foreignObject es complejo.
    // Alternativa práctica: dibujar desde el DOM con drawImage de un clone escalado.

    const frame = $('#videoFrame');
    // Método: usar html2canvas no está incluido. Hacemos un render manual simplificado.

    // Fondo
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    if (state.fondoUrl) {
      try {
        const img = await loadImage(state.fondoUrl);
        // Cover
        const scale = Math.max(w / img.width, h / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
      } catch (e) { /* ignore */ }
    } else {
      const grd = ctx.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, '#1a0a2e');
      grd.addColorStop(0.5, '#0f0a1a');
      grd.addColorStop(1, '#1a1030');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }

    // Overlay oscuro
    const osc = Number($('#fondoOscurecer').value) / 100;
    ctx.fillStyle = `rgba(0,0,0,${osc})`;
    ctx.fillRect(0, 0, w, h);

    // Chat window
    const chatPct = Number($('#chatSize').value) / 100;
    const chatW = w * chatPct;
    const chatH = h * 0.55;
    const chatX = (w - chatW) / 2;
    const chatY = (h - chatH) / 2;

    // Fondo del chat
    ctx.fillStyle = 'rgba(18, 18, 26, 0.92)';
    roundRect(ctx, chatX, chatY, chatW, chatH, 20);
    ctx.fill();

    // Borde
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.4)';
    ctx.lineWidth = 2;
    roundRect(ctx, chatX, chatY, chatW, chatH, 20);
    ctx.stroke();

    // Header
    ctx.fillStyle = 'rgba(124, 58, 237, 0.25)';
    roundRect(ctx, chatX, chatY, chatW, 40, 20, true, false);
    ctx.fill();
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Chat', w / 2, chatY + 26);

    // Mensajes visibles
    const names = state.personajes.map(p => p.nombre);
    const rightName = names[1] || names[0];
    let y = chatY + 55;
    const pad = 16;
    const maxBubbleW = chatW * 0.78;
    const visible = $$('#chatMessages .chat-bubble.visible');

    ctx.textAlign = 'left';
    for (const bubble of visible) {
      const idx = Number(bubble.dataset.idx);
      const m = state.mensajes[idx];
      if (!m) continue;
      const isOwn = m.personaje === rightName;
      const pj = state.personajes.find(p => p.nombre === m.personaje);

      // Medir texto
      ctx.font = '16px Inter, sans-serif';
      const lines = wrapText(ctx, m.texto, maxBubbleW - 24);
      const bubbleH = 28 + lines.length * 20;

      if (y + bubbleH > chatY + chatH - 20) break;

      const bw = Math.min(maxBubbleW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 24);
      const bx = isOwn ? chatX + chatW - pad - bw : chatX + pad;

      // Burbuja
      ctx.fillStyle = isOwn ? '#5b21b6' : '#1a1a26';
      roundRect(ctx, bx, y, bw, bubbleH, 12);
      ctx.fill();

      // Nombre
      ctx.fillStyle = isOwn ? 'rgba(255,255,255,0.7)' : '#a78bfa';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(m.personaje, bx + 12, y + 16);

      // Texto
      ctx.fillStyle = '#f1f1f5';
      ctx.font = '16px Inter, sans-serif';
      lines.forEach((line, li) => {
        ctx.fillText(line, bx + 12, y + 36 + li * 20);
      });

      y += bubbleH + 12;
    }

    // Watermark
    const wmText = $('#watermarkText').value || '';
    if (wmText) {
      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = `rgba(255,255,255,${Number($('#watermarkOpacity').value) / 100})`;
      const pos = $('#watermarkPos').value || 'bottom-right';
      const metrics = ctx.measureText(wmText);
      let wx = 20, wy = h - 20;
      if (pos === 'bottom-right') { wx = w - metrics.width - 20; wy = h - 20; }
      else if (pos === 'bottom-left') { wx = 20; wy = h - 20; }
      else if (pos === 'top-right') { wx = w - metrics.width - 20; wy = 30; }
      else if (pos === 'top-left') { wx = 20; wy = 30; }
      ctx.fillText(wmText, wx, wy);
    }
  }

  function roundRect(ctx, x, y, w, h, r, topOnly = false) {
    ctx.beginPath();
    if (topOnly) {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function exportAudio() {
    const urls = Object.values(state.audioMap);
    if (urls.length === 0) {
      toast('Primero genera las voces', 'error');
      return;
    }
    // Descargar el primero como ejemplo / o concatenar en cliente es complejo
    // Descargamos uno por uno o el merge del servidor
    try {
      const files = urls.map(u => u.split('/').pop());
      const data = await api('/api/video/merge-audio', {
        method: 'POST',
        body: { files }
      });
      if (data.audioUrl) {
        const a = document.createElement('a');
        a.href = data.audioUrl;
        a.download = 'vchat-audio.mp3';
        a.click();
        toast('Audio descargado', 'success');
      }
    } catch (err) {
      // Fallback: descargar el primero
      const a = document.createElement('a');
      a.href = urls[0];
      a.download = 'vchat-audio.mp3';
      a.click();
      toast('Se descargó el primer audio (merge no disponible)', 'info');
    }
  }

  function exportPNG() {
    updatePreviewStatic();
    renderChatBubbles(false);
    // Usar canvas para captura estática
    const w = 1080, h = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    drawFrameToCanvas(ctx, w, h).then(() => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vchat-chat.png';
        a.click();
        toast('Imagen descargada', 'success');
      }, 'image/png');
    });
  }

  // ========== STATUS ==========
  async function checkStatus() {
    try {
      const data = await api('/api/status');
      const dot = $('#apiStatus .status-dot');
      const text = $('#apiStatus .status-text');
      const cfg = $('#configStatus');

      const okO = data.apis.openai === 'configurada';
      const okE = data.apis.elevenlabs === 'configurada';

      if (okO && okE) {
        dot.className = 'status-dot ok';
        text.textContent = 'APIs listas';
      } else if (okO || okE) {
        dot.className = 'status-dot';
        text.textContent = 'APIs parciales';
      } else {
        dot.className = 'status-dot error';
        text.textContent = 'Configura las APIs';
      }

      cfg.innerHTML = `
        <p>OpenAI: <strong style="color:${okO ? 'var(--success)' : 'var(--danger)'}">${data.apis.openai}</strong></p>
        <p>ElevenLabs: <strong style="color:${okE ? 'var(--success)' : 'var(--danger)'}">${data.apis.elevenlabs}</strong></p>
        <p style="margin-top:8px;color:var(--text-muted)">${data.message}</p>
      `;
    } catch (e) {
      $('#apiStatus .status-text').textContent = 'Sin conexión';
      $('#apiStatus .status-dot').className = 'status-dot error';
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ========== INIT ==========
  function init() {
    initNav();
    initTabs();
    renderPersonajes();
    renderMensajes();
    checkStatus();

    // Personajes
    $('#btnAddPersonaje').addEventListener('click', () => openModalPersonaje());
    $('#closeModalPersonaje').addEventListener('click', closeModalPersonaje);
    $('#btnCancelPersonaje').addEventListener('click', closeModalPersonaje);
    $('#btnSavePersonaje').addEventListener('click', savePersonaje);
    $('#btnPjFoto').addEventListener('click', () => $('#pjFotoInput').click());
    $('#pjFotoInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        showLoading('Subiendo foto...');
        const url = await uploadFile(file);
        $('#pjFotoPreview').style.backgroundImage = `url(${url})`;
        $('#pjFotoPreview').dataset.url = url;
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        hideLoading();
      }
    });
    $('#btnRefreshVoces').addEventListener('click', loadVoces);

    // Historia
    $('#btnGenerarHistoria').addEventListener('click', () => generarHistoria('ia'));
    $('#btnGenerarPropia').addEventListener('click', () => generarHistoria('propia'));
    $('#btnIrEditor').addEventListener('click', () => {
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      $$('.section').forEach(s => s.classList.remove('active'));
      document.querySelector('[data-section="editor"]').classList.add('active');
      $('#section-editor').classList.add('active');
    });

    // Editor
    $('#btnAddMensaje').addEventListener('click', () => {
      if (state.personajes.length === 0) {
        toast('Primero crea personajes', 'error');
        return;
      }
      openModalMensaje();
    });
    $('#btnRegenerarTodo').addEventListener('click', () => {
      if (confirm('¿Regenerar toda la historia? Se perderán los mensajes actuales.')) {
        generarHistoria('ia');
      }
    });
    $('#closeModalMensaje').addEventListener('click', closeModalMensaje);
    $('#btnCancelMensaje').addEventListener('click', closeModalMensaje);
    $('#btnSaveMensaje').addEventListener('click', saveMensaje);
    $('#btnRegenMensaje').addEventListener('click', regenerarMensaje);

    // Preview
    $('#fondoOscurecer').addEventListener('input', updatePreviewStatic);
    $('#chatSize').addEventListener('input', updatePreviewStatic);
    $('#watermarkText').addEventListener('input', updatePreviewStatic);
    $('#watermarkOpacity').addEventListener('input', updatePreviewStatic);
    $('#watermarkPos').addEventListener('change', updatePreviewStatic);
    $('#btnElegirFondo').addEventListener('click', () => $('#fondoInput').click());
    $('#fondoInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        showLoading('Subiendo fondo...');
        const url = await uploadFile(file);
        state.fondoUrl = url;
        $('#fondoPreview').classList.remove('hidden');
        $('#fondoPreview').style.backgroundImage = `url(${url})`;
        updatePreviewStatic();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        hideLoading();
      }
    });
    $('#btnFondoDefault').addEventListener('click', () => {
      state.fondoUrl = null;
      $('#fondoPreview').classList.add('hidden');
      updatePreviewStatic();
    });
    $('#btnPlayPreview').addEventListener('click', playPreview);
    $('#btnStopPreview').addEventListener('click', stopPreview);
    $('#btnGenerarVoces').addEventListener('click', generarVoces);

    // Export
    $('#btnExportVideo').addEventListener('click', exportVideo);
    $('#btnExportAudio').addEventListener('click', exportAudio);
    $('#btnExportPNG').addEventListener('click', exportPNG);

    // Cargar voces al inicio si hay clave
    loadVoces().catch(() => {});
  }

  document.addEventListener('DOMContentLoaded', init);
})();
