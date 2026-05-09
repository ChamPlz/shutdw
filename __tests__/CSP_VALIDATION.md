# Validação CSP — ShutDW

## Como Validar o Content Security Policy

Este guia explica como validar a implementação CSP (Content Security Policy) no ShutDW.

## 1. Abra DevTools (F12)

### Electron Desktop App
1. Inicie o app: `npm start` ou `npm run dev`
2. Pressione `F12` ou `Ctrl+Shift+I` para abrir DevTools
3. Vá na aba **Console**

### Web Interface Remota
1. Inicie o servidor: `npm start`
2. Acesse `http://[seu-ip]:3333` pelo navegador
3. Abra DevTools (F12) → aba **Console**

## 2. Verifique os Headers CSP

No Console, execute:
```javascript
// Verificar headers da página
console.log(document.currentScript);
```

Ou na aba **Network**:
1. Recarregue a página (F5)
2. Clique na requisição principal (document)
3. Veja a aba **Headers** → procure por `content-security-policy`

### CSP Expected (Desktop - Electron)
```
default-src 'self';
script-src 'self' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' https: data: blob:;
font-src 'self' data:;
media-src 'self';
connect-src 'self' http://localhost:*;
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
```

### CSP Expected (Web Remote)
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' https: data: blob:;
font-src 'self' data:;
media-src 'self';
connect-src 'self';
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
```

## 3. Não Deve Haver Erros de CSP

No Console, procure por mensagens como:
- ❌ **Refused to execute inline script** — NÃO deve aparecer
  *(inline handlers foram removidos; scripts são carregados via files externos)*
- ❌ **Refused to load the script** — scripts só de 'self'
- ❌ **script-src 'unsafe-inline'** — NÃO deve constar no CSP da web remote

## 4. Verificação Específica — Overlay

O overlay (janela de shutdown em tela cheia) usa CSP restrito. Para testar:

1. Agende um shutdown de 1 minuto ou mais
2. Quando o overlay aparecer, abra DevTools (F12):
   - **Desktop app**: Devtools no overlay → aba **Console**
   - Clique nos botões **Fechar (X)** e **Cancelar**
   - Nenhum erro CSP deve aparecer
3. Event listeners devem funcionar pois são injetados via `executeJavaScript` após load (CSP compliant)

## 5. Checklist de Validação

- [ ] CSP header presente em todas as páginas
- [ ] Nenhuma referência a `'unsafe-inline'` no script-src da web remote
- [ ] Não há erros de CSP no Console do DevTools
- [ ] Botões do overlay funcionam sem erros de CSP
- [ ] QRs carregam de `api.qrserver.com` sem bloqueios
- [ ] API calls para `/status`, `/ip`, `/config/*` funcionam

## 6. Comandos curl para Verificação Rápida

```bash
# Verificar headers da landing page
curl -I http://localhost:3333/

# Verificar conteúdo completo (para buscar CSP header no response)
curl -v http://localhost:3333/ 2>&1 | grep -i "content-security-policy"

# Verificar resposta da API pública (sem CSP esperado pois é JSON)
curl -I http://localhost:3333/config/pin
```

## Resultado Esperado

- **CSP desktop**: `script-src 'self' 'unsafe-eval'` (Electron requer unsafe-eval internamente)
- **CSP web remote**: `script-src 'self'` (sem unsafe-inline, sem unsafe-eval)
- **Zero erros CSP** no console
- Overlay functions normalmente (event listeners injetados pós-load)
