# Notificações Flutuantes (Toasts) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as mensagens de status e o timer de contagem regressiva por toasts flutuantes fixos no canto inferior direito, em desktop e web.

**Architecture:** Lógica de toast centralizada em `shared/api.js` (função `showToast` que cria um container fixo dinamicamente). O timer usa o `#timerToast` persistente, reutilizando `startStatusPolling`/`updateTimer` já existentes. CSS por UI (temas distintos). Duas UIs idênticas em comportamento, HTML/CSS/JS próprios.

**Tech Stack:** Electron (renderer), Express (web), HTML/CSS/JS vanilla, Jest (testes existentes).

## Global Constraints

- Vale para **ambas** as interfaces: desktop (`renderer/`) e web (`web/`).
- **Timer** e **mensagens** são elementos flutuantes **separados**.
- Mensagens: **auto-dismiss** sucesso `4000ms`, erro `6000ms`, com botão X.
- Mensagens **empilham**; mais nova no topo; limite de **5** visíveis.
- Toast stack: `position: fixed; right: 12px; bottom: 76px; z-index: 1000`.
- Timer toast: `position: fixed; right: 12px; bottom: 12px; z-index: 1000`.
- `shared/api.js`, `renderer/renderer.js`, `web/app.js` **não podem** conter `require(` (verificado por `__tests__/client-require.test.js`).
- `npm test` deve passar ao final de cada task.
- **Sem novos testes automatizados** (lógica é DOM pura); validação manual por UI.
- `showStatus` e `showConfigStatus` permanecem exportadas em `shared/api.js`, mas deixam de ser usadas pelas UIs.

---

### Task 1: `showToast` e `savePinChange` em `shared/api.js`

**Files:**
- Modify: `shared/api.js:160-175` (seção STATUS, adicionar `showToast` + helpers)
- Modify: `shared/api.js:348-370` (`savePinChange` muda assinatura)
- Modify: `shared/api.js:491-506` (`module.exports` ganha `showToast`)
- Modify: `renderer/renderer.js:166` (`handleSavePin`)
- Modify: `web/app.js:166` (`handleSavePin`)

**Interfaces:**
- Consumes: nada novo.
- Produces:
  - `showToast(message, isError)` — `message: string`, `isError: boolean` (default `false`). Sem retorno útil.
  - `savePinChange(baseUrl, currentPinInput, newPinInput, onResult)` — `onResult(message: string, isError: boolean)`.
  - `displayStatus(message, isError)` já é o callback padrão usado nas UIs.

- [ ] **Step 1: Adicionar `showToast` e helpers em `shared/api.js`**

Na seção `// STATUS`, imediatamente antes de `showStatus` (após o comentário da seção), adicionar:

```js
/**
 * Exibe uma mensagem como toast flutuante fixo no canto inferior direito.
 * @param {string} message
 * @param {boolean} isError
 */
function showToast(message, isError = false) {
  if (typeof document === "undefined") return;

  const stack = document.querySelector(".shutdw-toast-stack");
  const container = stack || createToastStack();

  const toast = document.createElement("div");
  toast.className = `shutdw-toast ${isError ? "error" : "success"}`;

  const text = document.createElement("span");
  text.className = "shutdw-toast-text";
  text.textContent = message;

  const close = document.createElement("button");
  close.className = "shutdw-toast-close";
  close.type = "button";
  close.setAttribute("aria-label", "Fechar notificação");
  close.textContent = "×";

  toast.appendChild(text);
  toast.appendChild(close);

  container.appendChild(toast);

  const dismiss = () => removeToast(toast);
  close.addEventListener("click", dismiss);
  setTimeout(dismiss, isError ? 6000 : 4000);

  trimStack(container);
}

function createToastStack() {
  const container = document.createElement("div");
  container.className = "shutdw-toast-stack";
  container.setAttribute("aria-live", "polite");
  document.body.appendChild(container);
  return container;
}

function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add("shutdw-toast-leaving");
  toast.addEventListener("animationend", () => toast.remove(), { once: true });
}

function trimStack(container) {
  while (container.children.length > 5) {
    const oldest = container.firstElementChild;
    if (oldest) oldest.remove();
  }
}
```

- [ ] **Step 2: Mudar assinatura de `savePinChange` para callback**

Substituir a função `savePinChange` atual (com `statusEl`) por:

```js
/**
 * Salva um novo PIN (troca de PIN autenticada)
 * @param {string} baseUrl
 * @param {HTMLInputElement} currentPinInput
 * @param {HTMLInputElement} newPinInput
 * @param {function} onResult - Callback com (message, isError)
 */
function savePinChange(baseUrl, currentPinInput, newPinInput, onResult) {
  const currentPin = currentPinInput?.value;
  const newPin = newPinInput?.value;

  if (!currentPin || !newPin) {
    onResult("Preencha todos os campos", true);
    return;
  }

  apiRequest(baseUrl, "/config/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pin": currentPin },
    body: JSON.stringify({ newPin }),
  })
    .then(data => {
      onResult(data.status || data.error, !!data.error);
      if (!data.error) {
        currentPinInput.value = "";
        newPinInput.value = "";
      }
    })
    .catch(err => onResult(getErrorMessage(err), true));
}
```

- [ ] **Step 3: Exportar `showToast`**

Em `module.exports` de `shared/api.js`, adicionar `showToast` na lista (ex.: após `showStatus`):

```js
    apiRequest,
    sendAction,
    getErrorMessage,
    showToast,
    showStatus,
```

- [ ] **Step 4: Atualizar os dois `handleSavePin`**

`renderer/renderer.js` — substituir:

```js
function handleSavePin() {
  savePinChange(API_URL, el.currentPin, el.newPin, el.configStatus);
}
```

por:

```js
function handleSavePin() {
  savePinChange(API_URL, el.currentPin, el.newPin, displayStatus);
}
```

`web/app.js` — substituir:

```js
function handleSavePin() {
  savePinChange(API_URL, el.currentPin, el.newPin, el.configStatus);
}
```

por:

```js
function handleSavePin() {
  savePinChange(API_URL, el.currentPin, el.newPin, displayStatus);
}
```

- [ ] **Step 5: Rodar testes**

Run: `npm test`
Expected: todas as suítes passam (incluindo `api.test.js` e `client-require.test.js`).

- [ ] **Step 6: Commit**

```bash
git add shared/api.js renderer/renderer.js web/app.js
git commit -m "feat: showToast compartilhado e savePinChange com callback"
```

---

### Task 2: Interface Desktop (HTML + CSS + JS)

**Files:**
- Modify: `renderer/index.html:222-228` (remover card de status) e `renderer/index.html:270` (remover `#configStatus`)
- Modify: `renderer/index.html` (adicionar `#timerToast` antes dos `<script>`)
- Modify: `renderer/style.css:346-348` (remover `.card-status`) e `renderer/style.css:638-680` (remover status antigos, adicionar toasts/timer)
- Modify: `renderer/renderer.js:47-50` (`cacheElements`), `renderer/renderer.js:34` (polling), `renderer/renderer.js:150-152` (`displayStatus`), `renderer/renderer.js:175-195` (`resetPinDesktop`)

**Interfaces:**
- Consumes: `showToast(message, isError)`, `savePinChange(..., onResult)` da Task 1.
- Produces: `el.timerToast` (HTMLElement) usado pelo `startStatusPolling`.

- [ ] **Step 1: Remover card de status e `#configStatus` do HTML**

Em `renderer/index.html`, remover o bloco:

```html
          <!-- Status Display -->
          <div class="card card-status hidden" id="statuscard">
            <div class="card-body">
              <div id="timer" class="status-timer"></div>
              <div id="status" class="status-message"></div>
            </div>
          </div>
```

Em `renderer/index.html`, remover a linha:

```html
              <p id="configStatus" class="status-message"></p>
```

- [ ] **Step 2: Adicionar `#timerToast`**

Em `renderer/index.html`, imediatamente antes do bloco `<script src="../shared/api.js">`, adicionar:

```html
  <!-- Timer flutuante (contagem regressiva) -->
  <div id="timerToast" class="shutdw-timer-toast hidden"></div>
```

- [ ] **Step 3: Adicionar estilos de toast e timer em `renderer/style.css`**

Remover o bloco `.card-status`:

```css
.card-status {
  grid-column: 1 / -1;
}
```

Remover toda a seção `STATUS MESSAGES` (de `/* STATUS MESSAGES */` até o fechamento de `.status-message.error { ... }`), incluindo `@keyframes pulse-status`.

Adicionar no mesmo lugar:

```css
/* ==========================================================================
   TOASTS
   ========================================================================== */
.shutdw-toast-stack {
  position: fixed;
  right: 12px;
  bottom: 76px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: 320px;
  pointer-events: none;
}

.shutdw-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(100, 116, 139, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  animation: toast-in 0.25s ease;
  pointer-events: auto;
  max-width: 100%;
}

.shutdw-toast.success {
  color: var(--success);
  border-color: rgba(16, 185, 129, 0.4);
}

.shutdw-toast.error {
  color: var(--error);
  border-color: rgba(239, 68, 68, 0.4);
}

.shutdw-toast-text {
  flex: 1;
  word-break: break-word;
}

.shutdw-toast-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(100, 116, 139, 0.3);
  color: var(--gray-300);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s ease;
}

.shutdw-toast-close:hover {
  background: rgba(239, 68, 68, 0.6);
  color: #fff;
}

.shutdw-toast-leaving {
  animation: toast-out 0.3s ease forwards;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes toast-out {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(20px); }
}

/* ==========================================================================
   TIMER TOAST
   ========================================================================== */
.shutdw-timer-toast {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 1000;
  font-size: 14px;
  font-weight: 700;
  color: var(--purple-400);
  text-align: center;
  padding: 12px 16px;
  background: rgba(124, 58, 237, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(167, 139, 250, 0.3);
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.3);
  animation: pulse-status 2s ease-in-out infinite;
}

@keyframes pulse-status {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
```

- [ ] **Step 4: Atualizar `cacheElements` em `renderer/renderer.js`**

Substituir:

```js
  el.pinInput = $("pin");
  el.status = $("status");
  el.statusCard = $("statuscard");
  el.timer = $("timer");
  el.configStatus = $("configStatus");
```

por:

```js
  el.pinInput = $("pin");
  el.timerToast = $("timerToast");
```

- [ ] **Step 5: Atualizar polling em `init()`**

Substituir:

```js
  statusPollingCleanup = startStatusPolling(API_URL, el.timer, el.statusCard);
```

por:

```js
  statusPollingCleanup = startStatusPolling(API_URL, el.timerToast, null);
```

- [ ] **Step 6: `displayStatus` usa `showToast`**

Substituir:

```js
function displayStatus(message, isError = false) {
  showStatus(el.statusCard, el.status, message, isError);
}
```

por:

```js
function displayStatus(message, isError = false) {
  showToast(message, isError);
}
```

- [ ] **Step 7: `resetPinDesktop` usa `showToast`**

Substituir a função inteira:

```js
async function resetPinDesktop() {
  const newPin = el.newPin?.value;
  if (!newPin || newPin.length < 4) {
    showToast("Novo PIN precisa ter ao menos 4 caracteres", true);
    return;
  }
  if (!window.api?.resetPin) {
    showToast("Funcionalidade disponível somente no cliente desktop", true);
    return;
  }
  try {
    const result = await window.api.resetPin(newPin);
    showToast(result.status || "PIN redefinido com sucesso", !!result.error);
    if (!result.error) {
      if (el.currentPin) el.currentPin.value = "";
      if (el.newPin) el.newPin.value = "";
    }
  } catch {
    showToast("Erro ao redefinir PIN", true);
  }
}
```

- [ ] **Step 8: Rodar testes**

Run: `npm test`
Expected: todas as suítes passam.

- [ ] **Step 9: Validação manual desktop**

Run: `npm run dev`
Expected:
- Ao clicar "Desligar Agora" sem PIN: toast de erro no canto inferior direito.
- Agenda um timer (ex.: 10 min): `#timerToast` aparece no canto inferior direito com `⏱️ 10m 0s restantes` e conta.
- Clicar "Cancelar Agendamento": toast de sucesso; `#timerToast` some.
- Na aba Configurações, "Salvar Novo PIN" e "Redefinir PIN" mostram toasts.
- Vários toasts consecutivos empilham; o mais novo no topo; X fecha; erro some em ~6s.

- [ ] **Step 10: Commit**

```bash
git add renderer/index.html renderer/style.css renderer/renderer.js
git commit -m "feat: notificações flutuantes no desktop"
```

---

### Task 3: Interface Web (HTML + CSS + JS)

**Files:**
- Modify: `web/index.html:154-158` (remover `.status-container`) e `web/index.html:191` (remover `#configStatus`)
- Modify: `web/index.html` (adicionar `#timerToast` antes dos `<script>`)
- Modify: `web/style.css:394-447` (remover status antigos, adicionar toasts/timer)
- Modify: `web/app.js:38-42` (`cacheElements`), `web/app.js:25` (polling), `web/app.js:150-152` (`displayStatus`)

**Interfaces:**
- Consumes: `showToast(message, isError)`, `savePinChange(..., onResult)` da Task 1.
- Produces: `el.timerToast` (HTMLElement) usado pelo `startStatusPolling`.

- [ ] **Step 1: Remover `.status-container` e `#configStatus` do HTML**

Em `web/index.html`, remover o bloco:

```html
        <!-- Status Display -->
        <div class="status-container hidden">
          <p id="timer" class="status-timer"></p>
          <p id="status" class="status-message"></p>
        </div>
```

Em `web/index.html`, remover a linha:

```html
          <p id="configStatus" class="status-message"></p>
```

- [ ] **Step 2: Adicionar `#timerToast`**

Em `web/index.html`, imediatamente antes do bloco `<script src="api.js">`, adicionar:

```html
  <!-- Timer flutuante (contagem regressiva) -->
  <div id="timerToast" class="shutdw-timer-toast hidden"></div>
```

- [ ] **Step 3: Adicionar estilos de toast e timer em `web/style.css`**

Remover toda a seção `STATUS` (de `/* STATUS */` até o fechamento de `.status-message.error { ... }`), incluindo `.status-container`, `.status-container.hidden`, `.status-timer`, `.status-timer.active`, `@keyframes pulse`.

Adicionar no mesmo lugar:

```css
/* ==========================================================================
   TOASTS
   ========================================================================== */
.shutdw-toast-stack {
  position: fixed;
  right: 12px;
  bottom: 76px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: 320px;
  pointer-events: none;
}

.shutdw-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  background: var(--gray-900);
  border: 1px solid var(--gray-700);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
  animation: toast-in 0.25s ease;
  pointer-events: auto;
  max-width: 100%;
}

.shutdw-toast.success {
  color: var(--success);
  border-color: rgba(16, 185, 129, 0.5);
}

.shutdw-toast.error {
  color: var(--error);
  border-color: rgba(239, 68, 68, 0.5);
}

.shutdw-toast-text {
  flex: 1;
  word-break: break-word;
}

.shutdw-toast-close {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: var(--gray-700);
  color: var(--gray-300);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s ease;
}

.shutdw-toast-close:hover {
  background: rgba(239, 68, 68, 0.6);
  color: var(--white);
}

.shutdw-toast-leaving {
  animation: toast-out 0.3s ease forwards;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes toast-out {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(20px); }
}

/* ==========================================================================
   TIMER TOAST
   ========================================================================== */
.shutdw-timer-toast {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 1000;
  font-size: 16px;
  font-weight: 600;
  color: var(--purple-400);
  text-align: center;
  padding: 12px 16px;
  background: var(--gray-900);
  border-radius: 12px;
  border: 1px solid var(--gray-700);
  box-shadow: 0 12px 24px rgba(124, 58, 237, 0.3);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
```

- [ ] **Step 4: Atualizar `cacheElements` em `web/app.js`**

Substituir:

```js
  el.pin = $("pin");
  el.status = $("status");
  el.timer = $("timer");
  el.statusContainer = document.querySelector(".status-container");
  el.configStatus = $("configStatus");
```

por:

```js
  el.pin = $("pin");
  el.timerToast = $("timerToast");
```

- [ ] **Step 5: Atualizar polling em `init()`**

Substituir:

```js
  window._statusPollingCleanup = startStatusPolling(API_URL, el.timer, el.statusContainer);
```

por:

```js
  window._statusPollingCleanup = startStatusPolling(API_URL, el.timerToast, null);
```

- [ ] **Step 6: `displayStatus` usa `showToast`**

Substituir:

```js
function displayStatus(message, isError = false) {
  showStatus(el.statusContainer, el.status, message, isError);
}
```

por:

```js
function displayStatus(message, isError = false) {
  showToast(message, isError);
}
```

- [ ] **Step 7: Rodar testes**

Run: `npm test`
Expected: todas as suítes passam.

- [ ] **Step 8: Validação manual web**

Run: `npm run dev`, abrir `http://localhost:3333` no navegador.
Expected: mesmo comportamento da Task 2 (toasts no canto inferior direito, timer flutuante, empilhamento, X, auto-dismiss).

- [ ] **Step 9: Commit**

```bash
git add web/index.html web/style.css web/app.js
git commit -m "feat: notificações flutuantes na interface web"
```