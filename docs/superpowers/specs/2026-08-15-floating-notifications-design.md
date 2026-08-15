# Design — Notificações Flutuantes (Toasts)

**Data:** 2026-08-15
**Status:** Aprovado
**Escopo:** Desktop (Electron/renderer) + Interface Web/mobile

## Problema

As mensagens de status (ex.: "Desligamento em 10 minutos", "PIN inválido") e o
timer de contagem regressiva aparecem em um card no final da aba de controle
(`#statuscard` no desktop, `.status-container` na web). Para vê-los, o usuário
precisa rolar a tela.

## Objetivo

Exibir mensagens de status e o timer de contagem regressiva como elementos
flutuantes fixos no canto inferior direito da janela, sempre visíveis, sem
necessidade de scroll.

## Decisões de Escopo

- Válido para **ambas** as interfaces (desktop + web), usando o código
  compartilhado em `shared/api.js`.
- **Timer** e **mensagens** são elementos flutuantes **separados**.
- Mensagens têm **auto-dismiss + botão X** (sucesso ~4s, erro ~6s).
- Várias mensagens **empilham** (mais nova no topo, antigas deslizam para baixo).

## Abordagem escolhida

Abordagem 1 — Toast compartilhado em `shared/api.js`, com CSS por UI e timer
flutuante persistente. Segue o padrão já existente de código compartilhado.

## Componentes

### 1. Sistema de toast em `shared/api.js`

Nova função `showToast(message, isError = false)`:

- Cria dinamicamente (na primeira chamada) um container fixo no canto inferior
  direito:
  - `position: fixed; right: 12px; bottom: 76px;`
  - `z-index: 1000` (acima dos cards e da drag-bar `z-index: 10/11`, abaixo do
    modal `z-index: 9999`).
- Cada chamada adiciona um toast na pilha: o **mais novo fica no topo**, os
  antigos deslizam para baixo.
- Cada toast contém:
  - Texto da mensagem.
  - Botão de fechar (X) que remove o toast imediatamente.
- Auto-dismiss: sucesso ~4000ms, erro ~6000ms.
- Limite de ~5 toasts visíveis; o mais antigo é removido ao exceder o limite.
- Guard para `typeof document === "undefined"` (o arquivo é importado em testes
  Node via `module.exports`).

`showStatus` e `showConfigStatus` permanecem exportadas para compatibilidade,
mas deixam de ser usadas pelas UIs.

### 2. Timer flutuante

- Novo elemento `#timerToast` (div oculta por padrão) em ambos os HTMLs, fixado
  no canto inferior direito (`right: 12px; bottom: 12px`), abaixo da pilha de
  toasts.
- Elemento **persistente**: fica na tela enquanto houver desligamento ativo,
  atualizando a cada segundo via polling.
- `startStatusPolling(API_URL, el.timerToast, null)` — reutiliza a função
  existente em `shared/api.js`. Passar `null` como container é seguro, pois
  `updateTimer` já usa optional chaining (`containerEl?.`). O `#timerToast` é
  mostrado/ocultado conforme `remaining` muda e o texto
  `⏱️ Xm Ys restantes` continua vindo de `updateTimer`.

### 3. HTML e CSS (desktop + web)

**HTML:**
- Remover blocos antigos de status:
  - Desktop: `#statuscard` (card com `#timer` e `#status`).
  - Web: `.status-container` (com `#timer` e `#status`).
  - Ambos: `#configStatus`.
- Adicionar `#timerToast` em ambos.
- `el.timer`, `el.status`, `el.statusCard`, `el.configStatus` saem de
  `cacheElements`; entra `el.timerToast`.

**CSS (cada `style.css`, temas próprios):**
- Novo estilo:
  - `.shutdw-toast-stack` — container fixo.
  - `.shutdw-toast` — toast base, com variantes `.success` e `.error`.
  - `.shutdw-toast-close` — botão X.
  - Animações de entrada/saída (slide + fade).
- Novo estilo de `#timerToast` (persistente, mesmo visual de contagem atual).
- Remover estilos órfãos: `.status-timer`, `.status-message`, `.card-status`,
  `.status-container`, `.status-container.hidden`.

### 4. renderer.js / app.js

- `displayStatus` → chama `showToast`.
- `handleSavePin` e `resetPinDesktop` → chamam `showToast`.

`savePinChange` muda a assinatura de `statusEl` para callback
`onResult(message, isError)` (mesmo padrão de `sendAction`/`scheduleExactTime`).

## Fluxo de dados

1. Usuário dispara ação (shutdown, cancel, schedule, salvar PIN, redefinir PIN).
2. `sendAction`/`scheduleExactTime`/`savePinChange` resolvem/rejeitam e chamam o
   callback `onResult(message, isError)`.
3. `displayStatus` (renderer/web) chama `showToast`, que adiciona o toast na
   pilha fixa do canto inferior direito.
4. O polling de status atualiza `#timerToast` enquanto houver desligamento ativo.

## Tratamento de erros

- `showToast` é puro DOM, sem async; guard para ambiente sem `document`.
- Auto-dismiss usa `setTimeout` por toast; limpeza ocorre na remoção (X ou
  timeout).

## Testes

- Sem novos testes automatizados (lógica é DOM pura; o `client-require.test.js`
  continua valendo e garante que `shared/api.js`, `renderer/renderer.js` e
  `web/app.js` não usam `require()`).
- Validação manual: disparar ações e conferir empilhamento, auto-dismiss e
  timer flutuante em ambas as interfaces.