import { Navigate, useSearchParams } from "react-router";

import { URL_LOGIN_STEAM, useUsuario } from "../api/auth";
import { Carregando, Rotulo } from "../componentes/Basicos";
import { Logo } from "../componentes/Logo";

const O_QUE_LEMOS = [
  ["Lemos", "Seu SteamID e o perfil público: nome e avatar."],
  ["Não vemos", "Sua senha, e-mail ou carteira. O login acontece na própria Steam."],
  ["Para quê", "Guardar sua lista de acompanhamento, seus alertas e, depois, ler seu inventário."],
] as const;

export function Entrar() {
  const [parametros] = useSearchParams();
  const { data: usuario, isPending } = useUsuario();

  if (isPending) return <Carregando />;
  if (usuario) return <Navigate to="/itens" replace />;

  const falhou = parametros.has("erro");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-4 sm:px-6">
        <Logo />
      </header>

      <main className="grid flex-1 place-items-center px-4 pb-16">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-4">
            <Rotulo destaque>Acesso à plataforma</Rotulo>
            <h1 className="text-4xl leading-[1.05] titulo sm:text-5xl">
              Entre com a <span className="text-destaque">Steam.</span>
            </h1>
            <p className="text-suave">Sem cadastro novo: sua conta Steam já é sua conta no Skinomics.</p>
          </div>

          {falhou && (
            <p role="alert" className="rounded-lg border border-queda/30 bg-queda/10 px-4 py-3 text-sm text-queda">
              Não foi possível entrar com a Steam. Tente de novo em instantes.
            </p>
          )}

          {/* <a>, não <Link>: a ida para a Steam precisa ser uma navegação de página inteira. */}
          <a
            href={URL_LOGIN_STEAM}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-destaque px-4 py-3 font-medium text-fundo transition-opacity hover:opacity-90"
          >
            Continuar na Steam <span aria-hidden>↗</span>
          </a>

          <dl className="divide-y divide-borda rounded-xl border border-borda bg-painel">
            {O_QUE_LEMOS.map(([titulo, texto]) => (
              <div key={titulo} className="grid grid-cols-[6rem_1fr] gap-4 px-4 py-3 text-sm">
                <dt className="font-rotulo font-semibold tracking-[0.06em] text-suave">{titulo}</dt>
                <dd className="text-suave">{texto}</dd>
              </div>
            ))}
          </dl>

          <p className="text-xs text-apagado">
            Ao continuar, você concorda que o Skinomics guarde esses dados enquanto sua conta existir. Projeto acadêmico,
            não afiliado à Valve nem à Steam.
          </p>
        </div>
      </main>
    </div>
  );
}
