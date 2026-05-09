# Teste de Rate Limiting — ShutDW

## Objetivo
Validar que os rate limits estão funcionando corretamente, especialmente o diferenciação entre endpoints (/ip → leitura, /config/pin → ação).

## Pré-requisitos
1. O app deve estar rodando em `localhost:3333`
2. Se não houver PIN configurado,上皮

## Cenário 1 — Rate Limit de Autenticação (/config/pin)
Mais crítico: apenas 5 requisições por minuto.

### Passo a Passo:
```bash
# Limpar o terminal para contar melhor
clear

# Enviar 6 requisições POST consecutivas para /config/pin
for i in $(seq 1 6); do
  echo "Requisição $i"
  curl -s -X POST http://localhost:3333/config/pin \
    -H "Content-Type: application/json" \
    -d '{"newPin":"123456"}' \
    -w "\nHTTP Code: %{http_code}\n---\n"
  sleep 0.5
done
```

### Resultado Esperado:
- Requisições 1–5: `HTTP Code: 200`
- Requisição 6: `HTTP Code: 429` + mensagem de erro
- Após 60 segundos, deve-se poder tentar novamente

---

## Cenário 2 — Rate Limit de Leitura (/ip)
Mais permissivo: 120 requisições por minuto.

```bash
for i in $(seq 1 121); do
  curl -s http://localhost:3333/ip -o /dev/null -w "Req %d: %{http_code}\n" $i
  sleep 0.05
done
```

### Resultado Esperado:
- Requisições 1–120: `HTTP Code: 200`
- Algumas das requisições de 121+: `HTTP Code: 429`

---

## Cenário 3 — Rate Limit de Ação (/shutdown/:minutes ou /schedule)
20 requisições por minuto.

```bash
for i in $(seq 1 21); do
  curl -s -X POST http://localhost:3333/shutdown/60 \
    -H "x-pin: [PIN_VÁLIDO]" \
    -w "Req %d: %{http_code}\n" $i
  sleep 0.5
done
```

### Resultado Esperado:
- Primeiras 20: `HTTP Code: 200`
- 21ª: `HTTP Code: 429`

---

## Observação Importante
Se você não configurou um PIN, os endpoints autenticados retornarão `401 PIN não configurado.`
Nesse caso, configure primeiro um PIN via desktop app antes de testar os cenários 2 e 3.

## Validação dos Logs
O servidor deve logar eventos de rate limiting no console:
```
[warn] Rate limit exceeded — x-pin endpoint (ip: ::ffff:127.0.0.1)
[warn] Rate limit exceeded — read endpoint (ip: ::ffff:127.0.0.1)
[warn] Rate limit exceeded — action endpoint (ip: ::ffff:127.0.0.1)
```
