# Redesign do Overlay (Visual de Toast) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a janela overlay de contagem regressiva para o visual do `#timerToast` (barra escura translúcida, borda roxa, cantos 12px, pulse), mantendo o botão "cancelar" e o "×".

**Architecture:** Apenas restyle em `overlay/`. O HTML perde o wrapper `.pill-inner` (barra única), o CSS é reescrito replicando o visual do toast do renderer com valores literais (a janela overlay é separada e não acessa as variáveis CSS do renderer). IPC, JS e lógica de janela ficam intactos.

**Tech Stack:** Electron (BrowserWindow overlay), HTML/CSS/JS vanilla, Jest (testes existentes).

## Global Constraints

- Alvo: a janela overlay separada (`overlay/`), NÃO o `#timerToast` do app.
- "×" continua apenas escondendo a janela (desligamento continua); "cancelar" cancela o shutdown.
- Layout: barra com tempo + "cancelar" lado a lado, "×" no canto superior direito **da barra**.
- Barra (`.pill`): `position: relative`, `background: rgba(15, 23, 42, 0.92)`, `border: 1px solid rgba(167, 139, 250, 0.4)`, `border-radius: 12px`, sombra roxa, padding `12px 16px`. Sem animação.
- Tempo (`#time`): cor `#a78bfa`, bold, `font-variant-numeric: tabular-nums`, sem gradiente branco.
- Cancelar (`.cancel`): pílula gradiente roxo (`#6b46c1` → `#7c3aed`), texto branco.
- "×" (`.close`): círculo `position: absolute` no canto superior direito da barra (`top: -9px; right: -9px`), fundo `rgba(15, 23, 42, 0.8)` + borda roxa, `×` branco, hover vermelho.
- `body` = `-webkit-app-region: drag`; botões = `no-drag`.
- Janela mantém `300x120` (sem mudanças em `overlay/overlayWindow.js`).
- `npm test` deve passar (o `client-require.test.js` NÃO cobre `overlay/`).
- Sem novos testes automatizados (CSS/DOM puro); validação manual.

---

### Task 1: Restyle do overlay com visual de toast

**Files:**
- Modify: `overlay/overlay.html:14-24` (remover `.pill-inner`)
- Modify: `overlay/overlay.css` (reescrever estilos)

**Interfaces:**
- Consumes: ids `#time`, `#btnCancel`, `#btnClose` (já wired em `overlay/overlayWindow.js` via `did-finish-load` e atualizados por `overlay/overlay.js` via `getElementById("time")`).
- Produces: nada novo para outras tasks.

- [ ] **Step 1: Reescrever o corpo de `overlay/overlay.html`**

Substituir o bloco dentro de `<body>` por (removendo o wrapper `.pill-inner` e
aninhando o `#btnClose` dentro da barra `.pill`):

```html
<body>
  <div class="overlay">
    <div class="pill">
      <button id="btnClose" class="close" title="Fechar">×</button>
      <div id="time">--:--</div>
      <button id="btnCancel" class="cancel">cancelar</button>
    </div>
  </div>

  <script src="overlay.js"></script>
</body>
```

O restante do arquivo (head, CSP, link CSS) permanece inalterado.

- [ ] **Step 2: Reescrever `overlay/overlay.css`**

Substituir o conteúdo inteiro do arquivo por:

```css
/* ==========================================================================
   ShutDW - Overlay Styles
   Contagem regressiva de desligamento (visual de toast)
   ========================================================================== */

/* ==========================================================================
   BASE
   ========================================================================== */
* {
  box-sizing: border-box;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

body {
  margin: 0;
  width: 300px;
  height: 120px;
  background: transparent;
  -webkit-app-region: drag;
}

/* ==========================================================================
   OVERLAY CONTAINER
   ========================================================================== */
.overlay {
  position: relative;
  width: 300px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ==========================================================================
   TOAST BAR
   ========================================================================== */
.pill {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(167, 139, 250, 0.4);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.3);
}

/* ==========================================================================
   TIME DISPLAY
   ========================================================================== */
#time {
  color: #a78bfa;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.5px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

/* ==========================================================================
   CANCEL BUTTON
   ========================================================================== */
.cancel {
  background: linear-gradient(135deg, #6b46c1, #7c3aed);
  border: none;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 999px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
  transition: transform 0.15s ease, box-shadow 0.2s;
}

.cancel:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 20px rgba(124, 58, 237, 0.5);
}

.cancel:active {
  transform: scale(0.97);
}

/* ==========================================================================
   CLOSE BUTTON
   ========================================================================== */
.close {
  position: absolute;
  top: -9px;
  right: -9px;
  width: 26px;
  height: 26px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(167, 139, 250, 0.4);
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: transform 0.15s ease, background 0.2s;
}

.close:hover {
  transform: scale(1.1);
  background: rgba(239, 68, 68, 0.6);
}
```

- [ ] **Step 3: Rodar testes**

Run: `npm test`
Expected: todas as suítes passam (9/9, 85/85). Nenhum teste cobre `overlay/`, mas a suíte deve permanecer verde.

- [ ] **Step 4: Validação manual**

Run: `npm run dev`
Expected:
- Agendar um desligamento (ex.: 10 min): a janela overlay abre com a nova barra toast escura com borda roxa, `#time` em roxo mostrando `10:00`, sem animação.
- Clicar "cancelar": o overlay fecha E o desligamento é cancelado (o `#timerToast` do app também some).
- Agendar novamente e clicar no "×" (no canto da barra): o overlay fecha, mas o desligamento continua (reabrir/verificar via `/status` ou o `#timerToast` do app segue contando).

- [ ] **Step 5: Commit**

```bash
git add overlay/overlay.html overlay/overlay.css
git commit -m "feat: overlay de contagem regressiva com visual de toast"
```