/**
 * ShutDW — Módulo compartilhado entre renderer e web
 * Contém funções reutilizadas por ambas as interfaces
 */

// ============================================================================
// API
// ============================================================================

/**
 * Faz uma requisição à API local
 * @param {string} baseUrl - URL base da API (ex: "http://localhost:3333" ou "")
 * @param {string} route - Rota da API
 * @param {RequestInit} options - Opções do fetch
 * @returns {Promise<object>}
 */
async function apiRequest(baseUrl, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, options);
  return response.json();
}

/**
 * Envia uma ação POST autenticada por PIN
 * @param {string} baseUrl
 * @param {string} route
 * @param {string} pin
 * @param {function} onResult - Callback com (message, isError)
 */
function sendAction(baseUrl, route, pin, onResult) {
  apiRequest(baseUrl, route, {
    method: "POST",
    headers: { "x-pin": pin },
  })
    .then(data => onResult(data.status || data.error, !!data.error))
    .catch(() => onResult("Erro de conexão", true));
}

// ============================================================================
// STATUS
// ============================================================================

/**
 * Exibe mensagem de status em um container
 * @param {HTMLElement} container - Elemento container do status
 * @param {HTMLElement} messageEl - Elemento de texto da mensagem
 * @param {string} message
 * @param {boolean} isError
 */
function showStatus(container, messageEl, message, isError = false) {
  if (!container || !messageEl) return;
  container.classList.remove("hidden");
  messageEl.textContent = message;
  messageEl.className = isError ? "status-message error" : "status-message success";
}

/**
 * Atualiza o timer de contagem regressiva
 * @param {HTMLElement} timerEl
 * @param {HTMLElement} containerEl
 * @param {number|null} remaining - Segundos restantes
 */
function updateTimer(timerEl, containerEl, remaining) {
  if (!timerEl) return;

  if (remaining == null || remaining <= 0) {
    timerEl.textContent = "";
    timerEl.classList.add("hidden");
    containerEl?.classList.add("hidden");
    return;
  }

  containerEl?.classList.remove("hidden");
  timerEl.classList.remove("hidden");

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  timerEl.textContent = `⏱️ ${minutes}m ${seconds}s restantes`;
}

/**
 * Inicia polling de status com backoff inteligente
 * @param {string} baseUrl
 * @param {HTMLElement} timerEl
 * @param {HTMLElement} containerEl
 * @returns {function} Função de cleanup
 */
function startStatusPolling(baseUrl, timerEl, containerEl) {
  let intervalId = null;
  let hasActiveShutdown = false;

  function poll() {
    apiRequest(baseUrl, "/status")
      .then(data => {
        updateTimer(timerEl, containerEl, data.remaining);
        // Se não há shutdown ativo, reduz frequência para 5s
        if (data.remaining == null && hasActiveShutdown) {
          hasActiveShutdown = false;
          clearInterval(intervalId);
          intervalId = setInterval(poll, 5000);
        } else if (data.remaining != null) {
          hasActiveShutdown = true;
        }
      })
      .catch(() => {
        if (timerEl) {
          timerEl.textContent = "";
          timerEl.classList.add("hidden");
        }
      });
  }

  // Inicia polling rápido (1s)
  intervalId = setInterval(poll, 1000);

  // Retorna função de cleanup
  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}

/**
 * Mostra status na seção de configuração
 * @param {HTMLElement} el
 * @param {string} message
 * @param {boolean} isError
 */
function showConfigStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message;
  el.className = isError ? "status-message error" : "status-message success";
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================

/**
 * Alterna entre abas da interface
 * @param {string} tabName
 * @param {string} btnSelector - Seletor CSS para os botões das abas
 */
function switchTab(tabName, btnSelector = ".nav-item") {
  document.querySelectorAll(btnSelector).forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(tab => tab.classList.add("hidden"));

  const activeBtn = document.querySelector(`[onclick="showTab('${tabName}')"]`);
  if (activeBtn) activeBtn.classList.add("active");
  document.getElementById(tabName)?.classList.remove("hidden");
}

// ============================================================================
// PIN — Primeiro acesso
// ============================================================================

/**
 * Cria o primeiro PIN (modal de boas-vindas)
 * @param {string} baseUrl
 * @param {HTMLInputElement} pinInput
 * @param {HTMLInputElement} confirmInput
 * @param {HTMLElement} msgEl
 * @param {function} onSuccess - Callback ao criar com sucesso
 */
function createInitialPin(baseUrl, pinInput, confirmInput, msgEl, onSuccess) {
  const pin = pinInput?.value;
  const confirm = confirmInput?.value;

  if (!pin || pin.length < 4) {
    if (msgEl) msgEl.textContent = "PIN precisa ter ao menos 4 caracteres";
    return;
  }
  if (pin !== confirm) {
    if (msgEl) msgEl.textContent = "PIN e confirmação não conferem";
    return;
  }

  apiRequest(baseUrl, "/config/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPin: pin }),
  })
    .then(data => {
      if (data.error) {
        if (msgEl) msgEl.textContent = data.error;
        return;
      }
      if (msgEl) msgEl.textContent = data.status || "PIN criado com sucesso";
      if (onSuccess) setTimeout(onSuccess, 900);
    })
    .catch(() => {
      if (msgEl) msgEl.textContent = "Erro de conexão";
    });
}

/**
 * Salva um novo PIN (troca de PIN autenticada)
 * @param {string} baseUrl
 * @param {HTMLInputElement} currentPinInput
 * @param {HTMLInputElement} newPinInput
 * @param {HTMLElement} statusEl
 */
function savePinChange(baseUrl, currentPinInput, newPinInput, statusEl) {
  const currentPin = currentPinInput?.value;
  const newPin = newPinInput?.value;

  if (!currentPin || !newPin) {
    showConfigStatus(statusEl, "Preencha todos os campos", true);
    return;
  }

  apiRequest(baseUrl, "/config/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pin": currentPin },
    body: JSON.stringify({ newPin }),
  })
    .then(data => {
      showConfigStatus(statusEl, data.status || data.error, !!data.error);
      if (!data.error) {
        currentPinInput.value = "";
        newPinInput.value = "";
      }
    })
    .catch(() => showConfigStatus(statusEl, "Erro de conexão", true));
}

// ============================================================================
// SCHEDULE
// ============================================================================

/**
 * Agenda desligamento por horário exato
 * @param {string} baseUrl
 * @param {HTMLInputElement} timePickerEl
 * @param {string} pin
 * @param {function} onResult - Callback com (message, isError)
 */
function scheduleExactTime(baseUrl, timePickerEl, pin, onResult) {
  const timeValue = timePickerEl?.value;
  if (!timeValue) {
    onResult("Por favor, selecione um horário", true);
    return;
  }

  apiRequest(baseUrl, "/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pin": pin },
    body: JSON.stringify({ time: timeValue }),
  })
    .then(data => onResult(data.status || data.error, !!data.error))
    .catch(() => onResult("Erro de conexão", true));
}

// ============================================================================
// QR CODE
// ============================================================================

/**
 * Carrega QR Code IPv4
 * @param {string} baseUrl
 * @param {HTMLImageElement} qrImg
 * @param {HTMLAnchorElement} linkEl
 * @param {function} [openFn] - Função para abrir URL (Electron ou window.open)
 */
function loadQRCode(baseUrl, qrImg, linkEl, openFn) {
  apiRequest(baseUrl, "/ip")
    .then(data => {
      const url = data.url;
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
      }
      if (linkEl) {
        linkEl.textContent = url;
        linkEl.href = "#";
        linkEl.style.cursor = "pointer";
        linkEl.onclick = (e) => {
          e.preventDefault();
          if (openFn) openFn(url);
        };
      }
    })
    .catch(() => {
      if (linkEl) linkEl.textContent = "Erro ao carregar";
    });
}
