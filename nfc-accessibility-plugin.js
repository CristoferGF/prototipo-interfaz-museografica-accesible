/**
 * NFC Accessibility Multimedia Control Plugin
 * Actúa como módulo completamente aislado e independiente.
 * Proporciona soporte de accesibilidad web (WCAG 2.1) y Web Serial API.
 */

(function () {
  'use strict';

  // Configuración y variables de estado del Plugin
  const CONFIG = {
    baudRate: 9600,
    volumeStep: 0.1,
    speedStep: 0.25,
    minSpeed: 0.5,
    maxSpeed: 2.0
  };

  let state = {
    isActive: false,
    currentSpecimen: null,
    isPlaying: false,
    volume: 0.8, // 80% inicial
    playbackRate: 1.0,
    currentTime: 0,
    duration: 0,
    database: {} // Cargada dinámicamente desde datos_obras.json
  };

  let audioInstance = null;
  let speechUtterance = null; // Fallback de Texto a Voz
  let serialPort = null;
  let serialReader = null;
  let timerInterval = null;

  // Cache de nodos DOM del plugin
  let DOM = {
    root: null,
    srAlert: null,
    // Elementos del reproductor
    zoneTitle: null,
    playBtn: null,
    playIcon: null,
    statusText: null,
    subtitleText: null,
    timeDisplay: null,
    progressFill: null,
    progressBar: null,
    volumeDisplay: null,
    volumeMeter: null,
    speedDisplay: null,
    prevBtn: null,
    nextBtn: null,
    // Elementos de la ficha técnica
    specimenTitle: null,
    specimenScientific: null,
    descriptionBox: null,
    originVal: null,
    ageVal: null,
    tagIdVal: null,
    signalVal: null,
    narratorName: null
  };

  // Datos locales de respaldo en caso de fallo en el fetch de datos_obras.json
  const DATABASE_FALLBACK = {
    "044BFA197F6180": {
      "title": "Spiral Ammonite",
      "scientificName": "Nautilus macrocephalus",
      "description": "Esta vista frontal del espécimen revela el crecimiento logarítmico de la cámara. Las suturas visibles son indicativas de un individuo adulto en el periodo Cretácico Superior.",
      "origin": "Cordillera Real",
      "age": "120M Años",
      "tagId": "04:4B:FA:19:7F:61:80",
      "signal": "EXCELENTE (-45dBm)",
      "audioNarrator": "Voz Narrador A (Masculino)",
      "section": "Audio Guía: Sección 04/12",
      "duration": 320,
      "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    },
    "04D0241B7F6180": {
      "title": "Trilobite Fossil",
      "scientificName": "Elrathia kingii",
      "description": "Este trilobite del periodo Cámbrico presenta un exoesqueleto perfectamente segmentado. Su morfología revela adaptaciones avanzadas para la vida bentónica marina en aguas poco profundas de los océanos ancestrales.",
      "origin": "Desierto de Atacama",
      "age": "500M Años",
      "tagId": "04:D0:24:1B:7F:61:80",
      "signal": "BUENA (-60dBm)",
      "audioNarrator": "Voz Narradora B (Femenina)",
      "section": "Audio Guía: Sección 01/08",
      "duration": 225,
      "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
    },
    "04A4391D7F6180": {
      "title": "Tupuxuara Skull",
      "scientificName": "Tupuxuara leonardii",
      "description": "El cráneo preservado destaca por su enorme cresta sagital ósea, la cual cumplía funciones cruciales de termorregulación aerodinámica y exhibición de cortejo durante el periodo Cretácico Inferior.",
      "origin": "Cuenca del Araripe",
      "age": "112M Años",
      "tagId": "04:A4:39:1D:7F:61:80",
      "signal": "EXCELENTE (-40dBm)",
      "audioNarrator": "Voz Narrador C (Neutro)",
      "section": "Audio Guía: Sección 06/10",
      "duration": 252,
      "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
    },
    "04F6DA1A7F6180": {
      "title": "Megatherium Claw",
      "scientificName": "Megatherium americanum",
      "description": "Esta garra fosilizada de perezoso gigante terrestre del Pleistoceno destaca por su gran tamaño y curvatura. Adaptada para excavar raíces y defenderse de depredadores en los valles andinos.",
      "origin": "Valle de los Chillos",
      "age": "15,000 Años",
      "tagId": "04:F6:DA:1A:7F:61:80",
      "signal": "EXCELENTE (-48dBm)",
      "audioNarrator": "Voz Narrador D (Grave)",
      "section": "Audio Guía: Sección 09/12",
      "duration": 280,
      "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
    },
    "04CAB01B7F6181": {
      "title": "Obsidian Core",
      "scientificName": "Obsidiana vítrea",
      "description": "Núcleo volcánico vítreo de alta pureza. La fractura concoidea de este espécimen facilitó la elaboración de herramientas y armas cortantes por parte de las sociedades prehispánicas en la sierra norte ecuatoriana.",
      "origin": "Sierra de Quiscatola",
      "age": "8,000 Años",
      "tagId": "04:CA:B0:1B:7F:61:81",
      "signal": "BUENA (-55dBm)",
      "audioNarrator": "Voz Narradora E (Acento Suave)",
      "section": "Audio Guía: Sección 11/12",
      "duration": 195,
      "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"
    }
  };

  /**
   * Inicialización del Plugin
   */
  function init() {
    DOM.root = document.getElementById('nfc-plugin-root');
    if (!DOM.root) {
      console.warn('No se encontró el contenedor #nfc-plugin-root. Reintentando al cargar el DOM.');
      return;
    }

    // Inicializar estado oculto (nfc-passive)
    DOM.root.className = 'nfc-passive';

    // Cargar Base de Datos
    loadDatabase();

    // Renderizar la estructura interna HTML de forma aislada
    renderMarkup();

    // Enlazar Eventos de interfaz nativos (por si el usuario interactúa por teclado)
    bindUIEvents();

    // Inicializar Web Serial y Autoconectarse
    initSerialAPI();

    console.log('Plugin NFC de Accesibilidad cargado e inicializado de manera aislada.');
  }

  /**
   * Cargar datos desde el JSON externo
   */
  async function loadDatabase() {
    try {
      const response = await fetch('datos_obras.json');
      if (response.ok) {
        state.database = await response.json();
        console.log('Base de datos de obras cargada correctamente.');
      } else {
        throw new Error('Fallo en la carga remota');
      }
    } catch (e) {
      console.warn('No se pudo cargar datos_obras.json de forma dinámica. Utilizando datos locales de respaldo.', e);
      state.database = DATABASE_FALLBACK;
    }
  }

  /**
   * Renderiza el HTML del visualizador y ficha técnica
   */
  function renderMarkup() {
    DOM.root.innerHTML = `
      <!-- Región para Lectores de Pantalla (A11y Aria Live) -->
      <div id="nfc-sr-alert" class="nfc-sr-only" aria-live="assertive" aria-atomic="true"></div>

      <div class="nfc-container">
        <!-- Columna Izquierda: Reproductor Multimedia -->
        <section class="nfc-player-section" aria-label="Reproductor de Audio Guía">
          <div class="nfc-zone-header">
            <span class="nfc-zone-badge">Detección de Zona NFC</span>
            <h1 class="nfc-zone-title" id="nfc-zone-title-text">Cráneo - Vista Frontal</h1>
          </div>

          <div class="nfc-play-btn-wrapper">
            <button class="nfc-play-btn" id="nfc-main-play-btn" aria-label="Reproducir Audio Guía">
              <svg viewBox="0 0 24 24" id="nfc-play-svg">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>

          <div class="nfc-status-container">
            <div class="nfc-status-text" id="nfc-audio-status">PAUSADO</div>
            <div class="nfc-subtitle-text" id="nfc-audio-section-info">AUDIO GUÍA: SECCIÓN 00/00</div>
          </div>

          <div class="nfc-media-nav-group">
            <button class="nfc-nav-btn" id="nfc-btn-prev" aria-label="Sección anterior">
              <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              <span>Anterior</span>
            </button>

            <div class="nfc-timeline-container">
              <div class="nfc-progress-bar-wrapper" id="nfc-progress-bar" role="slider" aria-label="Progreso del audio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
                <div class="nfc-progress-fill" id="nfc-progress-fill"></div>
              </div>
              <div class="nfc-time-display" id="nfc-time-display">00:00 / 00:00</div>
            </div>

            <button class="nfc-nav-btn" id="nfc-btn-next" aria-label="Siguiente sección">
              <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6z"/></svg>
              <span>Siguiente</span>
            </button>
          </div>

          <!-- Controles de volumen y velocidad interactivos para A11y (WCAG 2.1) -->
          <div class="nfc-audio-parameters">
            <div class="nfc-parameter-card" aria-label="Control de Volumen">
              <span class="nfc-parameter-label">Volumen</span>
              <div class="nfc-parameter-value-row">
                <button class="nfc-parameter-btn" id="nfc-vol-down" aria-label="Disminuir volumen 10%" tabindex="0">-</button>
                <span id="nfc-volume-val">80%</span>
                <button class="nfc-parameter-btn" id="nfc-vol-up" aria-label="Aumentar volumen 10%" tabindex="0">+</button>
                <div class="nfc-volume-meter" id="nfc-volume-meter">
                  <div class="nfc-volume-bar"></div>
                  <div class="nfc-volume-bar"></div>
                  <div class="nfc-volume-bar"></div>
                  <div class="nfc-volume-bar"></div>
                  <div class="nfc-volume-bar"></div>
                  <div class="nfc-volume-bar"></div>
                  <div class="nfc-volume-bar"></div>
                  <div class="nfc-volume-bar"></div>
                  <div class="nfc-volume-bar"></div>
                  <div class="nfc-volume-bar"></div>
                </div>
              </div>
            </div>

            <div class="nfc-parameter-card" aria-label="Velocidad de audio">
              <span class="nfc-parameter-label">Velocidad</span>
              <div class="nfc-parameter-value-row">
                <button class="nfc-parameter-btn" id="nfc-speed-down" aria-label="Disminuir velocidad de audio" tabindex="0">-</button>
                <span id="nfc-speed-val">1.0x</span>
                <button class="nfc-parameter-btn" id="nfc-speed-up" aria-label="Aumentar velocidad de audio" tabindex="0">+</button>
                <span class="nfc-speed-badge">NORMAL</span>
              </div>
            </div>
          </div>

          <div class="nfc-hardware-footer">
            <div class="nfc-hw-badge">
              <svg class="nfc-hw-icon" viewBox="0 0 24 24">
                <path d="M12 3C6.48 3 2 7.48 2 13c0 2.76 1.12 5.26 2.93 7.07l1.41-1.41C4.95 17.28 4 15.25 4 13c0-4.42 3.58-8 8-8s8 3.58 8 8c0 2.25-.95 4.28-2.34 5.66l1.41 1.41C20.88 18.26 22 15.76 22 13c0-5.52-4.48-10-10-10zm0 4c-3.31 0-6 2.69-6 6 0 1.66.67 3.16 1.76 4.24l1.41-1.41C8.43 15.11 8 14.11 8 13c0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.11-.43 2.11-1.17 2.83l1.41 1.41C17.33 16.16 18 14.66 18 13c0-3.31-2.69-6-6-6zm0 4c-1.1 0-2 .9-2 2 0 .55.23 1.05.59 1.41l1.41-1.41c.2-.2.5-.2.7 0l1.41 1.41c.36-.36.59-.86.59-1.41 0-1.1-.9-2-2-2z"/>
              </svg>
              <span>Hardware Interface: NFC-PRO_CONTROLLER_V2</span>
            </div>
            <div class="nfc-mode-selector">
              <button class="nfc-mode-btn active" id="nfc-mode-guide">Modo Narrativo</button>
              <button class="nfc-mode-btn" id="nfc-mode-explore">Modo Descriptivo</button>
            </div>
          </div>
        </section>

        <!-- Columna Derecha: Ficha Técnica -->
        <aside class="nfc-specimen-details" aria-label="Ficha Técnica del Espécimen">
          <span class="nfc-meta-section-title">Ficha Técnica</span>
          <h2 class="nfc-specimen-title" id="nfc-specimen-title">Spiral Ammonite</h2>
          <div class="nfc-specimen-scientific" id="nfc-specimen-scientific">Nautilus macrocephalus</div>
          
          <div class="nfc-description-box" id="nfc-description-box" tabindex="0">
            Esta vista frontal del espécimen revela el crecimiento logarítmico de la cámara. Las suturas visibles son indicativas de un individuo adulto en el periodo Cretácico Superior.
          </div>

          <div class="nfc-quick-attributes">
            <div class="nfc-attribute-card">
              <div class="nfc-attribute-key">Origen</div>
              <div class="nfc-attribute-value" id="nfc-origin-val">Cordillera Real</div>
            </div>
            <div class="nfc-attribute-card">
              <div class="nfc-attribute-key">Antigüedad</div>
              <div class="nfc-attribute-value" id="nfc-age-val">120M Años</div>
            </div>
          </div>

          <div class="nfc-tag-meta">
            <div class="nfc-meta-row">
              <span class="nfc-meta-label">TAG ID:</span>
              <span class="nfc-meta-value" id="nfc-tag-id-val">04:A2:88:C1:90:5E:80</span>
            </div>
            <div class="nfc-meta-row">
              <span class="nfc-meta-label">Señal Antena:</span>
              <span class="nfc-meta-value" id="nfc-signal-val">EXCELENTE (-45dBm)</span>
            </div>
          </div>

          <div class="nfc-narrator-badge">
            <svg class="nfc-narrator-icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
            </svg>
            <div class="nfc-narrator-text-container">
              <span class="nfc-narrator-label">Audio Activo</span>
              <span class="nfc-narrator-name" id="nfc-narrator-name">Voz Narrador A (Masculino)</span>
            </div>
          </div>
        </aside>
      </div>
    `;

    // Asignar referencias a los elementos DOM
    DOM.srAlert = document.getElementById('nfc-sr-alert');
    DOM.zoneTitle = document.getElementById('nfc-zone-title-text');
    DOM.playBtn = document.getElementById('nfc-main-play-btn');
    DOM.playIcon = document.getElementById('nfc-play-svg');
    DOM.statusText = document.getElementById('nfc-audio-status');
    DOM.subtitleText = document.getElementById('nfc-audio-section-info');
    DOM.timeDisplay = document.getElementById('nfc-time-display');
    DOM.progressFill = document.getElementById('nfc-progress-fill');
    DOM.progressBar = document.getElementById('nfc-progress-bar');
    DOM.volumeDisplay = document.getElementById('nfc-volume-val');
    DOM.volumeMeter = document.getElementById('nfc-volume-meter');
    DOM.speedDisplay = document.getElementById('nfc-speed-val');
    DOM.prevBtn = document.getElementById('nfc-btn-prev');
    DOM.nextBtn = document.getElementById('nfc-btn-next');

    DOM.specimenTitle = document.getElementById('nfc-specimen-title');
    DOM.specimenScientific = document.getElementById('nfc-specimen-scientific');
    DOM.descriptionBox = document.getElementById('nfc-description-box');
    DOM.originVal = document.getElementById('nfc-origin-val');
    DOM.ageVal = document.getElementById('nfc-age-val');
    DOM.tagIdVal = document.getElementById('nfc-tag-id-val');
    DOM.signalVal = document.getElementById('nfc-signal-val');
    DOM.narratorName = document.getElementById('nfc-narrator-name');

    // Inicializar barras de volumen
    updateVolumeUI();
  }

  /**
   * Enlazar eventos de interfaz
   */
  function bindUIEvents() {
    // Botón de reproducción manual
    DOM.playBtn.addEventListener('click', togglePlayback);

    // Botones Anterior y Siguiente para navegación secuencial de especímenes
    DOM.prevBtn.addEventListener('click', loadPreviousSpecimen);
    DOM.nextBtn.addEventListener('click', loadNextSpecimen);

    // Botones interactivos de volumen y velocidad para cumplimiento WCAG 2.1 (A11y)
    document.getElementById('nfc-vol-down').addEventListener('click', function() { modifyVolume('DOWN'); });
    document.getElementById('nfc-vol-up').addEventListener('click', function() { modifyVolume('UP'); });
    document.getElementById('nfc-speed-down').addEventListener('click', function() { modifySpeed('DOWN'); });
    document.getElementById('nfc-speed-up').addEventListener('click', function() { modifySpeed('UP'); });

    // Botones de modo
    document.getElementById('nfc-mode-guide').addEventListener('click', function(e) {
      document.getElementById('nfc-mode-explore').classList.remove('active');
      e.target.classList.add('active');
      announceAccessibility('Cambiado a modo narrativo.');
    });

    document.getElementById('nfc-mode-explore').addEventListener('click', function(e) {
      document.getElementById('nfc-mode-guide').classList.remove('active');
      e.target.classList.add('active');
      announceAccessibility('Cambiado a modo descriptivo.');
    });

    // Soporte para simular barra de progreso (Click)
    DOM.progressBar.addEventListener('click', function (e) {
      if (!audioInstance) return;
      const rect = DOM.progressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      audioInstance.currentTime = percentage * audioInstance.duration;
      updatePlaybackProgress();
    });

    // Teclado en barra de progreso para a11y (Flechas izquierda/derecha)
    DOM.progressBar.addEventListener('keydown', function(e) {
      if (!audioInstance) return;
      if (e.key === 'ArrowRight') {
        audioInstance.currentTime = Math.min(audioInstance.duration, audioInstance.currentTime + 5);
        updatePlaybackProgress();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        audioInstance.currentTime = Math.max(0, audioInstance.currentTime - 5);
        updatePlaybackProgress();
        e.preventDefault();
      }
    });
  }

  /**
   * Anuncio dinámico para lectores de pantalla (A11y)
   */
  function announceAccessibility(text) {
    if (DOM.srAlert) {
      DOM.srAlert.textContent = '';
      setTimeout(() => {
        DOM.srAlert.textContent = text;
      }, 50);
    }
  }

  /**
   * Obtener la lista ordenada de UIDs de las obras registradas
   */
  function getOrderedUids() {
    return Object.keys(state.database);
  }

  /**
   * Carga secuencial del espécimen siguiente
   */
  function loadNextSpecimen() {
    const uids = getOrderedUids();
    if (uids.length === 0) return;

    let nextIndex = 0;
    if (state.currentSpecimen) {
      const currentIndex = uids.indexOf(state.currentSpecimen.tagId);
      if (currentIndex !== -1) {
        nextIndex = (currentIndex + 1) % uids.length;
      }
    }
    const nextUid = uids[nextIndex];
    activateUI();
    loadSpecimen(state.database[nextUid]);
  }

  /**
   * Carga secuencial del espécimen anterior
   */
  function loadPreviousSpecimen() {
    const uids = getOrderedUids();
    if (uids.length === 0) return;

    let prevIndex = uids.length - 1;
    if (state.currentSpecimen) {
      const currentIndex = uids.indexOf(state.currentSpecimen.tagId);
      if (currentIndex !== -1) {
        prevIndex = (currentIndex - 1 + uids.length) % uids.length;
      }
    }
    const prevUid = uids[prevIndex];
    activateUI();
    loadSpecimen(state.database[prevUid]);
  }

  /**
   * Conmutar entre Modo Narrativo y Modo Descriptivo
   */
  function toggleGuideMode() {
    const guideBtn = document.getElementById('nfc-mode-guide');
    const exploreBtn = document.getElementById('nfc-mode-explore');
    if (!guideBtn || !exploreBtn) return;

    const isGuideActive = guideBtn.classList.contains('active');
    if (isGuideActive) {
      // Activar Descriptivo
      guideBtn.classList.remove('active');
      exploreBtn.classList.add('active');
      announceAccessibility('Cambiado a modo descriptivo.');
    } else {
      // Activar Narrativo
      exploreBtn.classList.remove('active');
      guideBtn.classList.add('active');
      announceAccessibility('Cambiado a modo narrativo.');
    }
  }

  /**
   * Activa visualmente la interfaz al recibir el primer comando
   */
  function activateUI() {
    if (!state.isActive) {
      state.isActive = true;
      DOM.root.className = 'nfc-active';
      DOM.root.style.display = 'flex';
      
      // Enfocar contenedor descriptivo para el lector de pantalla
      setTimeout(() => {
        DOM.playBtn.focus();
      }, 100);
    }
  }

  /**
   * Regresa la interfaz al estado oculto/pasivo
   */
  function deactivateUI() {
    state.isActive = false;
    DOM.root.className = 'nfc-passive';
    DOM.root.style.display = 'none';
  }

  /**
   * Carga y reproduce el audio de un espécimen dado
   */
  function loadSpecimen(specimen) {
    stopCurrentAudio();
    state.currentSpecimen = specimen;

    // Actualizar campos de texto
    DOM.zoneTitle.textContent = `${specimen.title} - Vista Frontal`;
    DOM.specimenTitle.textContent = specimen.title;
    DOM.specimenScientific.textContent = specimen.scientificName;
    DOM.descriptionBox.textContent = specimen.description;
    DOM.originVal.textContent = specimen.origin;
    DOM.ageVal.textContent = specimen.age;
    DOM.tagIdVal.textContent = specimen.tagId;
    DOM.signalVal.textContent = specimen.signal;
    DOM.narratorName.textContent = specimen.audioNarrator;
    DOM.subtitleText.textContent = specimen.section.toUpperCase();

    // Actualizar clase de señal
    DOM.signalVal.className = 'nfc-meta-value ' + 
      (specimen.signal.includes('EXCELENTE') ? 'nfc-signal-excellent' : 'nfc-signal-good');

    // Inicializar reproductor de audio
    state.isPlaying = true;
    DOM.statusText.textContent = 'REPRODUCIENDO';
    DOM.playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; // Icono pausa
    DOM.playBtn.setAttribute('aria-label', 'Pausar Audio Guía');

    // Inicializar objeto de audio nativo
    audioInstance = new Audio();
    audioInstance.src = specimen.audioUrl;
    audioInstance.volume = state.volume;
    audioInstance.playbackRate = state.playbackRate;

    // Monitorear carga y errores de audio
    audioInstance.addEventListener('loadedmetadata', function () {
      state.duration = audioInstance.duration;
      updatePlaybackProgress();
    });

    audioInstance.addEventListener('timeupdate', updatePlaybackProgress);

    audioInstance.addEventListener('ended', function () {
      stopPlaybackState();
      announceAccessibility('La reproducción del audio guía ha finalizado.');
    });

    // Iniciar reproducción nativa
    audioInstance.play().then(() => {
      announceAccessibility(`Espécimen detectado: ${specimen.title}. Iniciando la reproducción de su audio guía.`);
      startTimer();
    }).catch(err => {
      console.warn('Fallo en la reproducción directa del archivo MP3. Iniciando Text-to-Speech de accesibilidad como respaldo.', err);
      // Fallback a Text-to-Speech de navegador (A11y)
      playSpeechFallback(specimen);
    });
  }

  /**
   * Lógica de síntesis de voz (Texto a voz) en caso de que no haya audio MP3
   */
  function playSpeechFallback(specimen) {
    stopCurrentAudio();
    state.isPlaying = true;
    DOM.statusText.textContent = 'REPRODUCIENDO';
    DOM.playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    
    // Crear simulación de tiempo
    state.duration = specimen.duration || 180;
    state.currentTime = 0;
    startTimer();

    // Iniciar síntesis por voz
    window.speechSynthesis.cancel();
    const voiceText = `${specimen.title}. ${specimen.scientificName}. ${specimen.description}`;
    speechUtterance = new SpeechSynthesisUtterance(voiceText);
    speechUtterance.lang = 'es-ES';
    speechUtterance.rate = state.playbackRate;
    speechUtterance.volume = state.volume;

    speechUtterance.onend = function () {
      stopPlaybackState();
      announceAccessibility('La lectura asistida ha finalizado.');
    };

    speechUtterance.onerror = function (e) {
      console.error('Error en síntesis de voz:', e);
      stopPlaybackState();
    };

    window.speechSynthesis.speak(speechUtterance);
    announceAccessibility(`Iniciando audioguía asistida por sintetizador para: ${specimen.title}.`);
  }

  /**
   * Detiene toda reproducción y sintetizadores activos
   */
  function stopCurrentAudio() {
    stopTimer();
    if (audioInstance) {
      audioInstance.pause();
      audioInstance.removeEventListener('timeupdate', updatePlaybackProgress);
      audioInstance = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      speechUtterance = null;
    }
  }

  /**
   * Detiene el estado y actualiza UI a parado
   */
  function stopPlaybackState() {
    stopCurrentAudio();
    state.isPlaying = false;
    DOM.statusText.textContent = 'PAUSADO';
    DOM.playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>'; // Icono Play
    DOM.playBtn.setAttribute('aria-label', 'Reproducir Audio Guía');
    state.currentTime = 0;
    updatePlaybackProgress();
  }

  /**
   * Alterna entre play y pausa (CMD:PAUSE_TOGGLE)
   */
  function togglePlayback() {
    if (!state.currentSpecimen) return;

    if (state.isPlaying) {
      // Pausar
      if (audioInstance) {
        audioInstance.pause();
      }
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
      }
      state.isPlaying = false;
      DOM.statusText.textContent = 'PAUSADO';
      DOM.playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      DOM.playBtn.setAttribute('aria-label', 'Reanudar Audio Guía');
      announceAccessibility('Audio guía pausado.');
      stopTimer();
    } else {
      // Reanudar
      state.isPlaying = true;
      DOM.statusText.textContent = 'REPRODUCIENDO';
      DOM.playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
      DOM.playBtn.setAttribute('aria-label', 'Pausar Audio Guía');
      announceAccessibility('Audio guía reanudado.');

      if (audioInstance) {
        audioInstance.play().catch(() => playSpeechFallback(state.currentSpecimen));
      } else if (window.speechSynthesis) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        } else {
          playSpeechFallback(state.currentSpecimen);
        }
      }
      startTimer();
    }
  }

  /**
   * Detiene la reproducción y limpia la interfaz (CMD:STOP)
   */
  function handleStopCommand() {
    stopPlaybackState();
    state.currentSpecimen = null;
    deactivateUI();
    announceAccessibility('Audioguía de zona detenida. Sistema de exploración pasivo listo.');
  }

  /**
   * Modifica el volumen de la audioguía (CMD:VOL_UP / CMD:VOL_DOWN)
   */
  function modifyVolume(direction) {
    if (direction === 'UP') {
      state.volume = Math.min(1.0, state.volume + CONFIG.volumeStep);
    } else if (direction === 'DOWN') {
      state.volume = Math.max(0.0, state.volume - CONFIG.volumeStep);
    }

    if (audioInstance) {
      audioInstance.volume = state.volume;
    }

    // Si hay un sintetizador reproduciendo, el volumen de SpeechSynthesis no se puede cambiar en caliente,
    // pero se aplicará al siguiente mensaje. Mostramos retroalimentación visual inmediata.
    updateVolumeUI();
    
    const percentage = Math.round(state.volume * 100);
    announceAccessibility(`Volumen ajustado al ${percentage} por ciento.`);
  }

  function updateVolumeUI() {
    const percentage = Math.round(state.volume * 100);
    DOM.volumeDisplay.textContent = `${percentage}%`;

    // Actualizar barras dinámicas (10 barras en total)
    const activeBarsCount = Math.round(state.volume * 10);
    const bars = DOM.volumeMeter.querySelectorAll('.nfc-volume-bar');
    bars.forEach((bar, index) => {
      if (index < activeBarsCount) {
        bar.classList.add('active');
      } else {
        bar.classList.remove('active');
      }
    });
  }

  /**
   * Modifica la velocidad del audio (CMD:SPEED_UP / CMD:SPEED_DOWN)
   */
  function modifySpeed(direction) {
    if (direction === 'UP') {
      state.playbackRate = Math.min(CONFIG.maxSpeed, state.playbackRate + CONFIG.speedStep);
    } else if (direction === 'DOWN') {
      state.playbackRate = Math.max(CONFIG.minSpeed, state.playbackRate - CONFIG.speedStep);
    }

    if (audioInstance) {
      audioInstance.playbackRate = state.playbackRate;
    }

    // Actualizar visualizador
    DOM.speedDisplay.textContent = `${state.playbackRate.toFixed(2)}x`;
    
    // Cambiar texto de etiqueta de velocidad
    const badge = DOM.root.querySelector('.nfc-speed-badge');
    if (state.playbackRate === 1.0) {
      badge.textContent = 'NORMAL';
    } else if (state.playbackRate > 1.0) {
      badge.textContent = 'RÁPIDO';
    } else {
      badge.textContent = 'LENTO';
    }

    // Si se usa síntesis de voz, reiniciamos la lectura con la nueva velocidad para mantener fidelidad
    if (window.speechSynthesis && window.speechSynthesis.speaking && !audioInstance) {
      playSpeechFallback(state.currentSpecimen);
    }

    announceAccessibility(`Velocidad de reproducción ajustada a ${state.playbackRate.toFixed(2)} equis.`);
  }

  /**
   * Temporizadores internos para simular y rastrear progreso de reproducción
   */
  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
      if (audioInstance) {
        state.currentTime = audioInstance.currentTime;
      } else {
        // Incremento simulado si es Texto a Voz
        state.currentTime = Math.min(state.duration, state.currentTime + state.playbackRate);
        updatePlaybackProgress();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /**
   * Formatea segundos a formato MM:SS
   */
  function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Sincroniza barra de progreso e indicadores temporales de reproducción
   */
  function updatePlaybackProgress() {
    const curTimeFormatted = formatTime(state.currentTime);
    const totalTimeFormatted = formatTime(state.duration);
    DOM.timeDisplay.textContent = `${curTimeFormatted} / ${totalTimeFormatted}`;

    const percent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
    DOM.progressFill.style.width = `${percent}%`;
    DOM.progressBar.setAttribute('aria-valuenow', Math.round(percent));
  }

  /**
   * Parser central de datos entrantes desde la Serial API (o simulados)
   */
  function parseSerialLine(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    console.log(`[SERIAL IN]: ${trimmedLine}`);

    // Reconocer tag NFC
    if (trimmedLine.startsWith('NFC_UID:')) {
      const rawUid = trimmedLine.replace('NFC_UID:', '').trim();
      const uid = rawUid.replace(/:/g, '').toUpperCase();
      const specimen = state.database[uid];
      
      activateUI();
      if (specimen) {
        loadSpecimen(specimen);
      } else {
        console.warn(`Tag NFC detectado (${uid}) pero no está registrado en la base de datos.`);
        announceAccessibility(`Dispositivo NFC detectado con identificador ${uid}, pero no hay ninguna ficha técnica asociada en el museo digital.`);
      }
    } 
    // Reconocer comandos de control
    else if (trimmedLine.startsWith('CMD:')) {
      const command = trimmedLine.replace('CMD:', '').trim();
      
      activateUI();
      
      // Análisis tolerante de comandos físicos (admite tramas con debug impreso al final)
      if (command.startsWith('PAUSE_TOGGLE') || command.startsWith('PAUSE') || command.startsWith('PLAY')) {
        togglePlayback();
      } 
      else if (command.startsWith('STOP')) {
        handleStopCommand();
      } 
      else if (command.startsWith('VOL_UP')) {
        modifyVolume('UP');
      } 
      else if (command.startsWith('VOL_DOWN')) {
        modifyVolume('DOWN');
      } 
      else if (command.startsWith('SPEED_UP')) {
        modifySpeed('UP');
      } 
      else if (command.startsWith('SPEED_DOWN')) {
        modifySpeed('DOWN');
      } 
      else if (command.startsWith('MODE_TOGGLE')) {
        toggleGuideMode();
      } 
      else if (command.startsWith('PREV')) {
        loadPreviousSpecimen();
      } 
      else if (command.startsWith('NEXT')) {
        loadNextSpecimen();
      } 
      else {
        console.warn(`Comando serial desconocido: ${command}`);
      }
    }
  }

  /**
   * Cierra de forma limpia cualquier comunicación serial activa y libera sus bloqueos
   */
  async function closeSerialConnection() {
    stopPlaybackState();
    
    if (serialReader) {
      try {
        await serialReader.cancel();
        serialReader.releaseLock();
      } catch (e) {
        console.log('Error al liberar el lector serial:', e);
      }
      serialReader = null;
    }
    
    if (serialPort) {
      try {
        await serialPort.close();
      } catch (e) {
        console.log('Error al cerrar el puerto serial:', e);
      }
      serialPort = null;
    }
    
    // Cambiar icono de conexión USB a gris (apagado)
    const icon = DOM.root ? DOM.root.querySelector('.nfc-hw-icon') : null;
    if (icon) icon.style.fill = 'var(--nfc-text-muted)';

    if (window.NfcSimulatorLog) {
      window.NfcSimulatorLog("Comunicación serial cerrada de forma limpia.", 'USB');
    }
  }

  /**
   * Configuración de la Web Serial API con soporte de auto-reconexión y desconexión en caliente
   */
  function initSerialAPI() {
    if (!('serial' in navigator)) {
      console.warn('La Web Serial API no está soportada en este navegador. Utilice Google Chrome o MS Edge.');
      if (window.NfcSimulatorLog) {
        window.NfcSimulatorLog("La Web Serial API no está soportada en este navegador. Utilice Google Chrome o MS Edge.", 'ERR');
      }
      return;
    }

    // Auto-conexión silenciosa al cargar la página a puertos ya autorizados
    navigator.serial.getPorts().then(ports => {
      if (ports.length > 0) {
        console.log(`Se detectaron ${ports.length} puertos autorizados previamente. Conectando al primero...`);
        if (window.NfcSimulatorLog) {
          window.NfcSimulatorLog(`Autodetectados ${ports.length} puertos previamente emparejados. Conectando...`, 'USB');
        }
        connectToPort(ports[0]);
      }
    }).catch(err => {
      console.error('Error al consultar puertos seriales disponibles:', err);
      if (window.NfcSimulatorLog) {
        window.NfcSimulatorLog(`Error al consultar puertos: ${err.message}`, 'ERR');
      }
    });

    // Detectar conexión de un dispositivo físico en caliente
    navigator.serial.addEventListener('connect', (event) => {
      console.log('Dispositivo Serial conectado físicamente.');
      announceAccessibility('Un módulo de hardware NFC ha sido conectado por puerto USB.');
      if (window.NfcSimulatorLog) {
        window.NfcSimulatorLog("Hardware detectado físicamente por USB. Intentando auto-conexión...", 'USB');
      }
      connectToPort(event.target);
    });

    // Detectar desconexión inesperada del dispositivo físico en caliente
    navigator.serial.addEventListener('disconnect', (event) => {
      if (serialPort === event.target) {
        console.warn('El dispositivo serial activo ha sido desconectado.');
        announceAccessibility('El módulo de hardware NFC ha sido desconectado físicamente.');
        if (window.NfcSimulatorLog) {
          window.NfcSimulatorLog("Módulo de hardware NFC desconectado físicamente del puerto USB.", 'USB');
        }
        closeSerialConnection();
      }
    });
  }

  /**
   * Conectar y leer de forma robusta desde el puerto USB
   */
  async function connectToPort(port) {
    // Si el puerto ya está abierto y activo, simplemente evitar abrirlo de nuevo
    if (port.readable) {
      console.log('El puerto serial ya está abierto y escuchando de forma activa.');
      if (window.NfcSimulatorLog) {
        window.NfcSimulatorLog("El dispositivo ya está conectado y activo.", 'USB');
      }
      // Asegurar que el icono USB de la UI esté encendido
      const icon = DOM.root ? DOM.root.querySelector('.nfc-hw-icon') : null;
      if (icon) icon.style.fill = 'var(--nfc-success-green)';
      serialPort = port;
      return;
    }

    // Si hay una conexión activa con otro puerto diferente, cerrarla de forma limpia primero
    if (serialPort && serialPort !== port) {
      await closeSerialConnection();
    }

    serialPort = port;
    try {
      await port.open({ baudRate: CONFIG.baudRate });
      console.log('Conexión serial física establecida con éxito.');
      announceAccessibility('Conectado con éxito al lector NFC de Arduino.');
      if (window.NfcSimulatorLog) {
        window.NfcSimulatorLog("¡CONEXIÓN SERIAL ESTABLECIDA CON ÉXITO! Escuchando tramas a 9600 baudios...", 'USB');
      }

      // Cambiar icono de conexión USB a verde (activo)
      const icon = DOM.root ? DOM.root.querySelector('.nfc-hw-icon') : null;
      if (icon) icon.style.fill = 'var(--nfc-success-green)';

      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      serialReader = textDecoder.readable.getReader();

      let buffer = '';
      try {
        while (true) {
          const { value, done } = await serialReader.read();
          if (done) {
            break;
          }
          if (value) {
            buffer += value;
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop(); // Mantener fragmento incompleto
            for (const line of lines) {
              // Redirigir la entrada real de datos de Arduino a la consola en pantalla para que el usuario la vea
              if (window.NfcSimulatorLog) {
                window.NfcSimulatorLog(line.trim(), 'RX');
              }
              parseSerialLine(line);
            }
          }
        }
      } catch (readError) {
        console.error('Error durante la lectura del flujo serial:', readError);
        if (window.NfcSimulatorLog) {
          window.NfcSimulatorLog(`Error en lectura de flujo: ${readError.message}`, 'ERR');
        }
      } finally {
        serialReader.releaseLock();
        await readableStreamClosed.catch(() => {});
      }
    } catch (error) {
      console.error('Fallo al abrir o leer desde el puerto serial:', error);
      announceAccessibility('No se pudo establecer comunicación serial con el dispositivo. Verifique los permisos del navegador.');
      if (window.NfcSimulatorLog) {
        window.NfcSimulatorLog(`ERROR DE COMUNICACIÓN: ${error.message}`, 'ERR');
      }
      
      // Apagar indicador visual
      const icon = DOM.root ? DOM.root.querySelector('.nfc-hw-icon') : null;
      if (icon) icon.style.fill = 'var(--nfc-text-muted)';
      serialPort = null;
      serialReader = null;
    }
  }

  /**
   * Función expuesta globalmente bajo el namespace window.NfcPlugin
   * Esto permite la integración limpia y simulación desde scripts externos
   */
  window.NfcPlugin = {
    // Inicializar el plugin manualmente si es necesario
    init: init,
    
    // Método para simular entradas físicas del Arduino directamente
    simulateCommand: function (line) {
      parseSerialLine(line);
    },

    // Emparejar manualmente un nuevo dispositivo (se requiere click del usuario)
    requestHardwareConnection: async function () {
      if (!('serial' in navigator)) {
        alert('Este navegador no soporta la Web Serial API. Por favor use Chrome, Edge u Opera.');
        return;
      }
      try {
        const port = await navigator.serial.requestPort();
        connectToPort(port);
      } catch (err) {
        console.warn('El usuario canceló la selección de puerto USB.', err);
      }
    },

    // Consultar el estado del reproductor
    getState: function () {
      return { ...state };
    }
  };

  // Autoejecución al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
