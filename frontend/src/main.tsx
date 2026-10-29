import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/space-grotesk";
import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";

import { MensagemErro } from "./componentes/Basicos";
import { Terminal } from "./componentes/Terminal";
import { DetalheItem } from "./paginas/DetalheItem";
import { ExplorarItens } from "./paginas/ExplorarItens";

const clienteDeConsultas = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
});

const rotas = createBrowserRouter([
  {
    element: <Terminal />,
    children: [
      { index: true, element: <Navigate to="/itens" replace /> },
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
