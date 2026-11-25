import assert from "node:assert/strict";
import { test } from "node:test";
import { sinalDoModelo } from "../src/lib/sinal.ts";

const previsao = (previsto, inferior, superior, extra = {}) => ({
  disponivel: true, preco_base: 1, preco_previsto: previsto, intervalo_inferior: inferior, intervalo_superior: superior, ...extra,
});

test("alta forte quando até o pior caso da faixa fica acima do preço-base", () => {
  const sinal = sinalDoModelo(previsao(1.1, 1.02, 1.2), 500);
  assert.equal(sinal.nivel, "alta_forte");
  assert.ok(sinal.ponteiro > 0.6);
});

test("baixa forte quando até o melhor caso fica abaixo", () => {
  assert.equal(sinalDoModelo(previsao(0.9, 0.8, 0.98), 500).nivel, "baixa_forte");
});

test("alta, baixa e neutro quando a faixa cruza o preço-base", () => {
  assert.equal(sinalDoModelo(previsao(1.05, 0.95, 1.15), 500).nivel, "alta");
  assert.equal(sinalDoModelo(previsao(0.95, 0.85, 1.05), 500).nivel, "baixa");
  assert.equal(sinalDoModelo(previsao(1.005, 0.92, 1.09), 500).nivel, "neutro");
});

test("sem leitura com dados frágeis", () => {
  assert.deepEqual(sinalDoModelo(undefined, 500), { tipo: "sem", motivo: "sem_previsao" });
  assert.deepEqual(sinalDoModelo(previsao(1.1, null, 1.2), 500), { tipo: "sem", motivo: "sem_previsao" });
  assert.deepEqual(sinalDoModelo(previsao(1.1, 1.02, 1.2), 30), { tipo: "sem", motivo: "pouco_volume" });
  assert.deepEqual(sinalDoModelo(previsao(1.1, 0.7, 1.5), 500), { tipo: "sem", motivo: "incerteza_alta" });
});

test("item no piso de preço da Steam fica sem leitura, mesmo com o pior caso acima", () => {
  const piso = { disponivel: true, preco_base: 0.03, preco_previsto: 0.032, intervalo_inferior: 0.0305, intervalo_superior: 0.035 };
  assert.deepEqual(sinalDoModelo(piso, 5000), { tipo: "sem", motivo: "piso" });
});

test("previsão desatualizada ainda dá leitura, marcada como tal", () => {
  const sinal = sinalDoModelo(previsao(1.1, 1.02, 1.2, { desatualizada: true }), 500);
  assert.equal(sinal.tipo, "leitura");
  assert.equal(sinal.desatualizado, true);
});
