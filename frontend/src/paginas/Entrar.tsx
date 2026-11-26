import { Navigate, useSearchParams } from "react-router";

import { URL_LOGIN_STEAM, useUsuario } from "../api/auth";
import { Carregando, Rotulo } from "../componentes/Basicos";
import { Logo } from "../componentes/Logo";
import { AcessoAnalise } from "../componentes/MenuAnalise";
import { t, useIdioma } from "../lib/idioma";

const O_QUE_LEMOS = () =>
  [
    [t("Lemos", "We read"), t("Seu SteamID e o perfil público: nome e avatar.", "Your SteamID and public profile: name and avatar.")],
    [t("Não vemos", "We don't see"), t("Sua senha, e-mail ou carteira. O login acontece na própria Steam.", "Your password, e-mail or wallet. You sign in on Steam itself.")],
    [t("Para quê", "What for"), t("Guardar sua lista de acompanhamento, seus alertas e, depois, ler seu inventário.", "To keep your follow list and your alerts and, later, read your inventory.")],
  ] as const;

export function Entrar() {
  useIdioma();
  const [parametros] = useSearchParams();
  const { data: usuario, isPending } = useUsuario();

  if (usuario) return <Navigate to="/itens" replace />;

  const falhou = parametros.has("erro");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Logo />
        <AcessoAnalise />
      </header>

      <main className="grid flex-1 place-items-center px-4 pb-16">
        {isPending ? <Carregando /> : <div className="w-full max-w-md space-y-8">
          <div className="space-y-4">
            <Rotulo destaque>{t("Acesso à plataforma", "Platform access")}</Rotulo>
            <h1 className="text-4xl leading-[1.05] titulo sm:text-5xl">
              {t("Entre com a", "Sign in with")} <span className="text-destaque">Steam.</span>
            </h1>
            <p className="text-suave">{t("Sem cadastro novo: sua conta Steam já é sua conta no Skinomics.", "No new sign-up: your Steam account is your Skinomics account.")}</p>
          </div>

          {falhou && (
            <p role="alert" className="rounded-lg border border-queda/30 bg-queda/10 px-4 py-3 text-sm text-queda">
              {t("Não foi possível entrar com a Steam. Tente de novo em instantes.", "Couldn't sign in with Steam. Try again in a moment.")}
            </p>
          )}

          {/* <a>, não <Link>: a ida para a Steam precisa ser uma navegação de página inteira. */}
          <a
            href={URL_LOGIN_STEAM}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-destaque px-4 py-3 font-medium text-fundo transition-opacity hover:opacity-90"
          >
            {t("Continuar na Steam", "Continue on Steam")} <span aria-hidden>↗</span>
          </a>

          <dl className="divide-y divide-borda rounded-xl border border-borda bg-painel">
            {O_QUE_LEMOS().map(([titulo, texto]) => (
              <div key={titulo} className="grid grid-cols-[6rem_1fr] gap-4 px-4 py-3 text-sm">
                <dt className="font-rotulo font-semibold tracking-[0.06em] text-suave">{titulo}</dt>
                <dd className="text-suave">{texto}</dd>
              </div>
            ))}
          </dl>

          <p className="text-xs text-apagado">
            {t(
              "Ao continuar, você concorda que o Skinomics guarde esses dados enquanto sua conta existir. O Skinomics não é afiliado à Valve nem à Steam.",
              "By continuing, you agree that Skinomics keeps this data while your account exists. Skinomics isn't affiliated with Valve or Steam.",
            )}
          </p>
        </div>}
      </main>
    </div>
  );
}
