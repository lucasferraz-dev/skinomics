import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { type UsuarioAtual, useSair, useUsuario } from "../api/auth";

export function nomeDoUsuario(usuario: UsuarioAtual) {
  return usuario.nome ?? "Conta Steam";
}

export function AvatarSteam({ usuario, tamanho = 28 }: { usuario: UsuarioAtual; tamanho?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-md border border-borda bg-painel-alto"
      style={{ width: tamanho, height: tamanho }}
    >
      {usuario.avatar_url ? (
        <img src={usuario.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        <span className="font-mono text-[11px] text-suave">{nomeDoUsuario(usuario).slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

/** Canto do cabeçalho: quem está logado (com menu) ou o convite para entrar. */
export function MenuConta() {
  const { data: usuario, isPending } = useUsuario();

  if (isPending) {
    return <span className="size-7 animate-pulse rounded-md bg-painel-alto" aria-hidden />;
  }
  if (!usuario) {
    return (
      <Link
        to="/entrar"
        className="rounded-lg border border-borda px-3 py-1.5 text-sm transition-colors hover:border-suave"
      >
        Entrar
      </Link>
    );
  }
  return <MenuUsuario usuario={usuario} />;
}

function MenuUsuario({ usuario }: { usuario: UsuarioAtual }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const sair = useSair();

  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (evento: MouseEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    };
    const fecharEsc = (evento: KeyboardEvent) => evento.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fecharFora);
    document.addEventListener("keydown", fecharEsc);
    return () => {
      document.removeEventListener("mousedown", fecharFora);
      document.removeEventListener("keydown", fecharEsc);
    };
  }, [aberto]);

  const opcao = "block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-painel-alto";

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 transition-colors hover:bg-painel-alto"
      >
        <AvatarSteam usuario={usuario} />
        <span className="hidden max-w-40 truncate text-sm sm:block">{nomeDoUsuario(usuario)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-apagado" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-borda bg-painel p-1.5 shadow-2xl shadow-black/50">
          <div className="border-b border-borda px-3 pt-2 pb-3">
            <p className="truncate text-sm">{nomeDoUsuario(usuario)}</p>
            <p className="mt-0.5 font-mono text-[11px] text-apagado">{usuario.steam_id}</p>
          </div>
          <div className="pt-1.5">
            <a
              role="menuitem"
              href={`https://steamcommunity.com/profiles/${usuario.steam_id}`}
              target="_blank"
              rel="noreferrer"
              className={`${opcao} text-suave hover:text-texto`}
            >
              Perfil na Steam <span aria-hidden>↗</span>
            </a>
            <button
              role="menuitem"
              type="button"
              onClick={() => sair.mutate()}
              disabled={sair.isPending}
              className={`${opcao} text-queda disabled:opacity-50`}
            >
              {sair.isPending ? "Saindo…" : "Sair"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
