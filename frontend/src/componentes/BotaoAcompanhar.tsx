import { Link } from "react-router";

import { useUsuario } from "../api/auth";
import { ErroApi } from "../api/cliente";
import { useAlternarAcompanhamento, useMinhaLista } from "../api/minhaLista";

const base =
  "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm whitespace-nowrap transition-colors disabled:opacity-60";

function IconeMarcador({ cheio }: { cheio: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={cheio ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  );
}

/** Põe ou tira o item da "Minha lista". Sem login, leva para a tela de entrar. */
export function BotaoAcompanhar({ itemId }: { itemId: number }) {
  const { data: usuario, isPending: carregandoUsuario } = useUsuario();
  const lista = useMinhaLista();
  const alternar = useAlternarAcompanhamento();

  if (carregandoUsuario) return null;
  if (!usuario) {
    return (
      <Link to="/entrar" className={`${base} border-borda text-suave hover:border-suave hover:text-texto`}>
        <IconeMarcador cheio={false} />
        Acompanhar
      </Link>
    );
  }

  // Enquanto o pedido não volta, o botão já mostra o estado novo.
  const acompanhando = alternar.isPending ? alternar.variables.acompanhar : Boolean(lista.data?.some((item) => item.id === itemId));
  const listaCheia = alternar.error instanceof ErroApi && alternar.error.status === 409;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-pressed={acompanhando}
        disabled={lista.isPending || alternar.isPending}
        onClick={() => alternar.mutate({ itemId, acompanhar: !acompanhando })}
        className={`${base} ${
          acompanhando
            ? "border-destaque/30 bg-destaque-fundo text-destaque"
            : "border-borda text-suave enabled:hover:border-suave enabled:hover:text-texto"
        }`}
      >
        <IconeMarcador cheio={acompanhando} />
        {acompanhando ? "Acompanhando" : "Acompanhar"}
      </button>
      {alternar.isError && (
        <span role="alert" className="text-xs text-queda">
          {listaCheia ? "Sua lista está cheia." : "Não deu certo. Tente de novo."}
        </span>
      )}
    </div>
  );
}
