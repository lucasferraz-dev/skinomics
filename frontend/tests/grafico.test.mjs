import assert from "node:assert/strict";
import { test } from "node:test";
import { intervaloValido, prepararGrafico } from "../src/lib/grafico.ts";

const historico = [{ data: "2026-10-14", preco: 2, volume: 10, preenchido: false }];
const dia = (numero) => new Date(Date.UTC(2026, 9, 14 + numero)).toISOString().slice(0, 10);
const previsao = (horizonte = 7) => ({
  disponivel: true, horizonte, data_base: "2026-10-14", preco_base: 2, preco_previsto: 2.5,
  data_alvo: dia(horizonte), janela_inicio: dia(horizonte - 2), janela_fim: dia(horizonte + 2),
  intervalo_inferior: 1.8, intervalo_superior: 3.2, nivel_confianca: 0.8,
});

for (const horizonte of [7, 15, 30]) {
  test(`gráfico liga a base ao alvo de ${horizonte} dias com intervalo, sem inventar preços diários`, () => {
    const { dados, futuro } = prepararGrafico(historico, previsao(horizonte));
    assert.equal(dados.length, 2);
    assert.equal(dados[0].precoPrevisto, 2);
    assert.equal(dados[1].preco, null);
    assert.equal(dados[1].precoPrevisto, 2.5);
    assert.equal(dados[1].data, dia(horizonte));
    assert.equal(dados[1].volume, null);
    assert.deepEqual(futuro.intervalo, { inferior: 1.8, superior: 3.2 });
    assert.equal(historico[0].precoPrevisto, undefined);
  });
}

test("legado, carregamento e horizonte indisponível não fabricam faixa", () => {
  assert.equal(prepararGrafico(historico).futuro, null);
  assert.equal(prepararGrafico(historico, { ...previsao(), disponivel: false }).futuro, null);
  assert.equal(prepararGrafico(historico, { ...previsao(), nivel_confianca: null }).futuro.intervalo, null);
});

test("base incompatível não conecta uma previsão ao histórico errado", () => {
  for (const change of [{ preco_base: 3 }, { data_base: "2026-10-13" }, { preco_previsto: NaN }]) {
    assert.equal(prepararGrafico(historico, { ...previsao(), ...change }).futuro, null);
  }
});

test("não desenha limites inválidos ou nível diferente de 80%", () => {
  for (const change of [
    { intervalo_inferior: 0 }, { intervalo_inferior: 3 }, { intervalo_superior: 2 },
    { intervalo_superior: Infinity }, { intervalo_inferior: null }, { nivel_confianca: 0.95 },
  ]) assert.equal(intervaloValido({ ...previsao(), ...change }), null);
});
