import { t } from "../lib/idioma";
import { BotaoIdioma } from "./BotaoIdioma";
import { MenuConta } from "./Conta";
import { IconeFaq } from "./IconesAnimados";
import { Logo } from "./Logo";
import { SinoAlertas } from "./alertas/SinoAlertas";
import { AcessoAnalise } from "./MenuAnalise";
import { BotaoModoTv, classeBotaoRedondo } from "./modoTv/ModoTv";
import { BotaoTelaCheia } from "./modoTv/TelaCheia";
import { BotaoComoUsar } from "./tutorial/Tutorial";

/**
 * O header do site, igual na landing e no Terminal: alto, translúcido e fixo no topo, com o logo na ponta
 * esquerda e os botões redondos na direita. O modo TV passeia pelas seções da página aberta; fora da
 * landing, o FAQ leva para a seção da landing.
 */
export function Cabecalho({ landing = false }: { landing?: boolean }) {
  return (
    <header className="sticky top-0 z-50 h-32 border-b border-borda/60 bg-fundo/55 backdrop-blur-[3px]">
      {/* O conteúdo fica na faixa de cima; a de baixo é só o fundo translúcido. */}
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Logo grande />
        <div className="flex items-center gap-2">
          <BotaoComoUsar />
          <a
            href={landing ? "#faq" : "/#faq"}
            data-tour="faq"
            aria-label={t("Perguntas frequentes", "Frequently asked questions")}
            title={t("Perguntas frequentes", "Frequently asked questions")}
            className={classeBotaoRedondo}
          >
            <IconeFaq />
          </a>
          <BotaoModoTv />
          <BotaoTelaCheia />
          <span data-tour="menu-analise">
            <AcessoAnalise redondo />
          </span>
          <BotaoIdioma />
          <SinoAlertas />
          <span data-tour="conta">
            <MenuConta redondo />
          </span>
        </div>
      </div>
    </header>
  );
}
