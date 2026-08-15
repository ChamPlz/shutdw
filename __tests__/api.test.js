/**
 * Testes para shared/api.js
 * Cobre: propagação de mensagens de erro do servidor e orientação de PIN
 */

const { apiRequest, sendAction } = require("../shared/api");

describe("shared/api.js — mensagens de erro", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("apiRequest extrai a mensagem de erro do servidor em resposta não-ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: "PIN inválido" }),
    });

    await expect(apiRequest("", "/shutdown")).rejects.toMatchObject({
      isHttpError: true,
      status: 401,
      message: "PIN inválido",
    });
  });

  test("apiRequest usa fallback HTTP quando corpo não tem erro", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => {
        throw new Error("corpo inválido");
      },
    });

    await expect(apiRequest("", "/shutdown/abc")).rejects.toMatchObject({
      isHttpError: true,
      status: 400,
      message: "HTTP 400 Bad Request",
    });
  });

  test("apiRequest marca erro de rede como conexão", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiRequest("", "/shutdown")).rejects.toMatchObject({
      isNetworkError: true,
      message: "Erro de conexão",
    });
  });

  test("sendAction com PIN vazio informa que o PIN é necessário", async () => {
    const onResult = jest.fn();
    sendAction("", "/shutdown", "", onResult);
    expect(onResult).toHaveBeenCalledWith("Digite o PIN para executar esta ação", true);
  });

  test("sendAction mostra a mensagem do servidor em 401", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: "PIN inválido" }),
    });
    const onResult = jest.fn();
    await sendAction("", "/shutdown", "9999", onResult);
    expect(onResult).toHaveBeenCalledWith("PIN inválido", true);
  });

  test("sendAction mostra 'Erro de conexão' em falha de rede", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const onResult = jest.fn();
    await sendAction("", "/shutdown", "1234", onResult);
    expect(onResult).toHaveBeenCalledWith("Erro de conexão", true);
  });

  test("sendAction com sucesso repassa status do servidor", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "Desligamento em 10 minutos" }),
    });
    const onResult = jest.fn();
    await sendAction("", "/shutdown/10", "1234", onResult);
    expect(onResult).toHaveBeenCalledWith("Desligamento em 10 minutos", false);
  });
});