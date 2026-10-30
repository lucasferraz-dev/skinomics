// Archivo com o eixo de largura (wdth), usado pelos títulos largos.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/cinzel";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import { MensagemErro } from "./componentes/Basicos";
import { Terminal } from "./componentes/Terminal";
import { DetalheItem } from "./paginas/DetalheItem";
import { Entrar } from "./paginas/Entrar";
import { ExplorarItens } from "./paginas/ExplorarItens";
import { Inicio } from "./paginas/inicio/Inicio";

const clienteDeConsultas = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
});

const rotas = createBrowserRouter([
  { path: "/", element: <Inicio /> },
  { path: "/entrar", element: <Entrar /> },
  {
    element: <Terminal />,
    children: [
      { path: "itens", element: <ExplorarItens /> },
      { path: "itens/:id", element: <DetalheItem /> },
      { path: "*", element: <MensagemErro titulo="Página não encontrada." /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={clienteDeConsultas}>
      <RouterProvider router={rotas} />
    </QueryClientProvider>
  </StrictMode>,
);
