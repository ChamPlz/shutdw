# Teste externo de IPv6 para acesso remoto

Data: 2026-08-15
Status: Aprovado

## Problema

`hasIPv6Available()` (server/network.js) apenas verifica se existe um endereço IPv6
não-interno em alguma interface de rede local. Isso não reflete se o IPv6 realmente
funciona para **acesso remoto** (via internet), que é o propósito do recurso.

## Objetivo

Determinar, nas configurações, se o IPv6 está:

- **external**: conectividade externa confirmada por uma requisição HTTP real a um
  serviço só-IPv6 → acesso remoto via internet disponível.
- **local**: endereço IPv6 global existe na máquina, mas o teste externo falhou →
  mostra "apenas IPv6 local".
- **unavailable**: sem endereço IPv6 global utilizável.

## Decisões

1. Teste externo via `fetch` HTTPS para `https://api6.ipify.org` (serviço só-IPv6,
   retorna o IP público em texto puro).
2. Fallback para endereço local quando o teste externo falha, exibindo ao usuário
   que o acesso é apenas local.
3. O endereço público retornado pelo teste externo é usado na URL de acesso remoto
   (`/ip6`), pois é o endereço efetivamente alcançável.

## Arquitetura

### `server/network.js`

- `IPV6_TEST_ENDPOINT = "https://api6.ipify.org"` — constante.
- `getPublicIpv6(timeout = 5000)`:
  - `fetch` com `AbortController` para timeout.
  - Retorna IP público (string) se `res.ok` e o corpo for um IPv6 válido; senão `null`.
  - Falha de rede/timeout → `null` (nunca lança).
- `isLinkLocal(ip)` — detecta `fe80::/10` (case-insensitive).
- `getIPv6Status(publicLookup = getPublicIpv6, outboundLookup = getOutboundIpv6)`:
  - `publicIp = await publicLookup()` → se válido, retorna `{ status: "external", publicIp }`.
  - `localIp = await outboundLookup()` → se válido e não link-local, retorna
    `{ status: "local", ipv6: localIp }`.
  - Senão `{ status: "unavailable" }`.
- `getIPv6StatusCached()` — cache em memória com TTL 5 min (mesmo TTL do QR cache).

### `server/routes.js`

- `GET /config/ipv6-available`:
  - `const status = await getIPv6StatusCached()`
  - Resposta: `{ ...status, enabled: config.useIPv6 }`.
- `GET /ip6`:
  - Mantém gate por `config.useIPv6` e cache de QR.
  - Endereço: `status.publicIp || status.ipv6`.
  - Se não houver endereço → `404 { error: "IPv6 não disponível" }`.
  - Inclui `external: status.status === "external"` na resposta.

### `renderer/renderer.js` — `setupIPv6Settings()`

- `external` → "IPv6 disponível para acesso remoto" (verde), mostra toggle, carrega link.
- `local` → "IPv6 disponível apenas na rede local" (laranja), mostra toggle, avisa que
  acesso remoto externo não foi confirmado.
- `unavailable` → "IPv6 não está disponível" (vermelho), esconde toggle.

## Tratamento de erros

- Falha no teste externo nunca quebra o fluxo: cai para o fallback local ou
  `unavailable`.
- Timeout de 5s no `fetch` via `AbortController`.

## Testes

- `__tests__/network.test.js` (novo):
  - `getPublicIpv6` com `global.fetch` mockado: sucesso (IP), `!res.ok` → null,
    fetch rejeita → null.
  - `isLinkLocal`: casos fe80::/10 vs global.
  - `getIPv6Status` com `publicLookup`/`outboundLookup` injetados: external, local,
    unavailable.
- `__tests__/routes.test.js`:
  - Atualizar mock de `../server/network` para incluir `getIPv6StatusCached`.
  - Testes para `GET /config/ipv6-available` (external/local/unavailable) e `GET /ip6`
    usando o endereço público quando disponível.

## Fora de escopo

- Não altera o middleware de bloqueio de IPv6 em `routes.js`.
- Não adiciona verificação de reachability **inbound** (firewall/porta), apenas
  conectividade externa de saída como proxy.