# Design — Overlay de Contagem Regressiva com Visual de Toast

**Data:** 2026-08-15
**Status:** Aprovado
**Escopo:** Janela overlay separada (sempre-por-cima) em `overlay/`

## Problema

A janela overlay (a "pílula" roxa flutuante que aparece ao agendar um
desligamento) tem visual diferente do novo sistema de toasts flutuantes
adotado na interface. O usuário quer que o overlay use o mesmo visual do
`#timerToast` (barra escura translúcida, borda roxa, cantos arredondados),
mantendo o botão "cancelar" e o "×".

## Decisões de Escopo

- Alvo: a **janela overlay separada** (`overlay/`), não o `#timerToast` do app.
- O "×" continua **apenas escondendo a janela** (o desligamento continua);
  "cancelar" cancela o desligamento.
- Layout: **barra** com tempo + "cancelar" lado a lado, e o "×" no canto
  superior direito **da barra**.
- Abordagem: restyle do `overlay.css` + simplificação mínima do `overlay.html`
  (Abordagem 1). IPC, JS e lógica de janela ficam intactos.

## Componentes

### 1. Visual da barra (replica o `#timerToast`)

- **Barra** (`.pill`): `position: relative`, fundo escuro translúcido
  `rgba(15, 23, 42, 0.92)` (mais opaco que o toast, pois não há backdrop-blur
  sobre o desktop), borda `1px solid rgba(167, 139, 250, 0.4)`,
  `border-radius: 12px`, sombra roxa, padding `12px 16px`. Sem animação.
- **Tempo** (`#time`): cor `#a78bfa` (purple-400 do tema), bold,
  `font-variant-numeric: tabular-nums`, sem o gradiente branco atual.
- **Botão "cancelar"** (`.cancel`): pílula com gradiente roxo (estilo
  `.btn-primary` do app), texto branco, `no-drag`.
- **Botão "×"** (`.close`): círculo pequeno `position: absolute` no canto
  superior direito da barra (`top: -9px; right: -9px`), fundo escuro
  translúcido + borda roxa, `×` branco, `no-drag`.

### 2. `overlay/overlay.html`

Simplificar a estrutura removendo o wrapper `.pill-inner` (o novo design é uma
barra única), mantendo os ids `#time`, `#btnCancel` e `#btnClose`:

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

### 3. `overlay/overlay.css`

Reescrever `.pill` (barra toast), `#time` (roxo, bold), `.cancel` (pílula
gradiente roxa), `.close` (círculo escuro + borda roxa). Manter
`-webkit-app-region`: `body` = `drag`; botões = `no-drag`.

### 4. `overlay/overlayWindow.js`

Manter `300x120` (cabe o "×" no canto e a barra centralizada). **Sem mudanças
de lógica**: os botões já estão wired via `did-finish-load` (o "×" chama
`window.close()` — esconde a janela; "cancelar" chama `overlay.cancel()` →
IPC `overlay:cancel` → `process.emit("cancel-shutdown")`).

## Fluxo

1. Usuário agenda um desligamento.
2. `server/shutdown.js` chama `createOverlay()` e `sendRemaining()`.
3. O overlay renderiza a barra toast com o tempo restante (via
   `overlay:update` → `formatTime`).
4. "cancelar" cancela o shutdown; "×" apenas esconde a janela.

## Tratamento de erros

- Sem mudanças de lógica; comportamento de botões preservado.
- `sendRemaining` já ignora quando a janela está fechada (guard em
  `overlayWindow.js`).

## Testes

- Sem novos testes automatizados (CSS/DOM puro; `client-require.test.js` não
  cobre `overlay/`).
- `npm test` deve continuar passando.
- Validação manual: agendar desligamento e conferir a nova aparência + os dois
  botões (cancelar cancela; "×" esconde a janela mantendo o agendamento).