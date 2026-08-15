/**
 * ShutDW — Módulo compartilhado entre renderer e web
 * Contém funções reutilizadas por ambas as interfaces
 */

const QR_CACHE_TTL = 5 * 60 * 1000;
const QR_CACHE_KEY = "shutdw_qr_cache";

/**
 * Retorna cachedata de IP da localStorage se ainda válida
 * @param {string} key - "ipv4" ou "ipv6"
 * @returns {object|null}
 */
function getLocalIPCache(key) {
  try {
    const raw = localStorage.getItem(QR_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (!cache[key]) return null;

    const entry = cache[key];
    if (Date.now() - entry.timestamp > QR_CACHE_TTL) {
      // Expirado — limpa
      delete cache[key];
      localStorage.setItem(QR_CACHE_KEY, JSON.stringify(cache));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Limpa um entry específico do cache de IP local
 * @param {string} key - "ipv4" ou "ipv6"
 */
function clearLocalIPCache(key) {
  try {
    const raw = localStorage.getItem(QR_CACHE_KEY);
    if (!raw) return;
    const cache = JSON.parse(raw);
    delete cache[key];
    localStorage.setItem(QR_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage indisponível
  }
}

/**
 * Salva dados de IP na localStorage com timestamp
 * @param {string} key - "ipv4" ou "ipv6"
 * @param {object} data - Dados da resposta
 */
function setLocalIPCache(key, data) {
  try {
    const raw = localStorage.getItem(QR_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    cache[key] = { data, timestamp: Date.now() };
    localStorage.setItem(QR_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage indisponível (modo privado/incognito)
  }
}

/**
 * Busca IP (cached ou fresh) — abstrai lógica de cache entre apps
 * @param {string} baseUrl - URL base da API
 * @param {string} route - "/ip" ou "/ip6"
 * @param {string} cacheKey - "ipv4" ou "ipv6"
 * @returns {Promise<object>}
 */
async function getCachedIP(baseUrl, route, cacheKey) {
  console.log("[getCachedIP]", baseUrl, route, cacheKey);
  // Tenta cache local primeiro (funciona offline entre recargas)
  const localCached = getLocalIPCache(cacheKey);
  if (localCached) {
    console.log("[getCachedIP] cache HIT:", cacheKey, localCached);
    return localCached;
  }

  // Se não houver cache válido, busca da API
  console.log("[getCachedIP] cache MISS — buscando da API");
  const data = await apiRequest(baseUrl, route);
  console.log("[getCachedIP] dados recebidos:", data);
  setLocalIPCache(cacheKey, data);
  return data;
}

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
  console.log("[apiRequest]", baseUrl + route);
  let response;
  try {
    response = await fetch(`${baseUrl}${route}`, options);
  } catch (fetchErr) {
    if (fetchErr && fetchErr.name === "AbortError") throw fetchErr;
    const err = new Error("Erro de conexão");
    err.isNetworkError = true;
    throw err;
  }
  if (!response.ok) {
    let message = `HTTP ${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body && typeof body.error === "string" && body.error) {
        message = body.error;
      }
    } catch {
    }
    const err = new Error(message);
    err.status = response.status;
    err.isHttpError = true;
    throw err;
  }
  return response.json();
}

/**
 * Converte um erro em mensagem exibível, preservando AbortError
 * @param {Error} err
 * @returns {string}
 */
function getErrorMessage(err) {
  if (err && (err.name === "AbortError" || err.isHttpError)) return err.message;
  return "Erro de conexão";
}

/**
 * Envia uma ação POST autenticada por PIN
 * @param {string} baseUrl
 * @param {string} route
 * @param {string} pin
 * @param {function} onResult - Callback com (message, isError)
 */
function sendAction(baseUrl, route, pin, onResult) {
  if (!pin) {
    onResult("Digite o PIN para executar esta ação", true);
    return;
  }
  return apiRequest(baseUrl, route, {
    method: "POST",
    headers: { "x-pin": pin },
  })
    .then(data => onResult(data.status || data.error, !!data.error))
    .catch(err => onResult(getErrorMessage(err), true));
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
 * Usa setTimeout recursivo para evitar requisições paralelas
 * e pausa quando a aba/janela não está visível
 * @param {string} baseUrl
 * @param {HTMLElement} timerEl
 * @param {HTMLElement} containerEl
 * @returns {function} Função de cleanup
 */
function startStatusPolling(baseUrl, timerEl, containerEl) {
  let timeoutId = null;
  let hasActiveShutdown = false;
  let isVisible = true;
  const FAST_POLL = 1000;
  const SLOW_POLL = 5000;

  function scheduleNext(delay) {
    timeoutId = setTimeout(poll, delay);
  }

  function poll() {
    if (!isVisible) {
      // Pausa polling enquanto não visível; agenda verificação em 1s
      timeoutId = setTimeout(poll, 1000);
      return;
    }

    apiRequest(baseUrl, "/status")
      .then(data => {
        updateTimer(timerEl, containerEl, data.remaining);

        const isActive = data.remaining != null && data.remaining > 0;

        if (isActive && !hasActiveShutdown) {
          hasActiveShutdown = true;
          scheduleNext(FAST_POLL);
        } else if (!isActive && hasActiveShutdown) {
          hasActiveShutdown = false;
          scheduleNext(SLOW_POLL);
        } else {
          scheduleNext(isActive ? FAST_POLL : SLOW_POLL);
        }
      })
      .catch(() => {
        if (timerEl) {
          timerEl.textContent = "";
          timerEl.classList.add("hidden");
        }
        scheduleNext(SLOW_POLL);
      });
  }

  function handleVisibilityChange() {
    isVisible = !document.hidden;
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Primeira execução imediata
  scheduleNext(0);

  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
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

  const activeBtn = document.getElementById(`nav${tabName.charAt(0).toUpperCase()}${tabName.slice(1)}`);
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
    .catch(err => {
      if (msgEl) msgEl.textContent = getErrorMessage(err);
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
    .catch(err => showConfigStatus(statusEl, getErrorMessage(err), true));
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
  if (!pin) {
    onResult("Digite o PIN para executar esta ação", true);
    return;
  }

  apiRequest(baseUrl, "/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pin": pin },
    body: JSON.stringify({ time: timeValue }),
  })
    .then(data => onResult(data.status || data.error, !!data.error))
    .catch(err => onResult(getErrorMessage(err), true));
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
  getCachedIP(baseUrl, "/ip", "ipv4")
    .then(data => {
      console.log("[loadQRCode] data:", data);
      const url = data.url;
      if (!url) {
        throw new Error("URL vazia na resposta da API");
      }
      if (qrImg) {
        console.log("[loadQRCode] setando qrImg.src");
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
      }
      if (linkEl) {
        linkEl.textContent = url;
        linkEl.href = "#";
        linkEl.style.cursor = "pointer";
        // CSP-compliant: remove inline handler, use addEventListener
        // Remove listener anterior se existir para evitar accumulation
        const newListener = (e) => {
          e.preventDefault();
          if (openFn) openFn(url);
        };
        // Armazena listener no elemento para remoção futura
        if (linkEl._shutdwQrListener) {
          linkEl.removeEventListener("click", linkEl._shutdwQrListener);
        }
        linkEl.addEventListener("click", newListener);
        linkEl._shutdwQrListener = newListener;
      }
    })
    .catch(err => {
      console.error("[loadQRCode] erro completo:", err);
      if (linkEl) linkEl.textContent = "Erro ao carregar: " + (err.message || String(err));
    });
}

/**
 * Carrega QR Code IPv6
 * @param {string} baseUrl
 * @param {HTMLImageElement} qrImg
 * @param {HTMLAnchorElement} linkEl
 * @param {function} [openFn] - Função para abrir URL (Electron ou window.open)
 */
function loadQRIpv6(baseUrl, qrImg, linkEl, openFn) {
  getCachedIP(baseUrl, "/ip6", "ipv6")
    .then(data => {
      const url = data.url;
      if (!url) {
        if (qrImg) qrImg.style.display = "none";
        if (linkEl) linkEl.textContent = "IPv6 não disponível";
        return;
      }
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
      }
      if (linkEl) {
        linkEl.textContent = url;
        linkEl.href = "#";
        linkEl.style.cursor = "pointer";
        // CSP-compliant: remove inline handler, use addEventListener
        // Remove listener anterior se existir para evitar accumulation
        const newListener = (e) => {
          e.preventDefault();
          if (openFn) openFn(url);
        };
        if (linkEl._shutdwQrListener) {
          linkEl.removeEventListener("click", linkEl._shutdwQrListener);
        }
        linkEl.addEventListener("click", newListener);
        linkEl._shutdwQrListener = newListener;
      }
    })
    .catch(() => {
      if (linkEl) linkEl.textContent = "Erro ao carregar IPv6";
    });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    apiRequest,
    sendAction,
    getErrorMessage,
    showStatus,
    updateTimer,
    startStatusPolling,
    showConfigStatus,
    createInitialPin,
    savePinChange,
    scheduleExactTime,
    loadQRCode,
    loadQRIpv6,
    getCachedIP,
  };
}
