# ATRETU UI Guidelines

Referencia oficial de Design System para o modulo administrativo do ATRETU.

Este documento registra os padroes visuais aprovados ate a Sprint 7.2. Novos
modulos administrativos devem reutilizar estes principios, tokens e componentes
antes de criar qualquer variacao propria.

## 1. Principios de design

- O ATRETU deve parecer uma plataforma SaaS profissional, operacional e
  confiavel.
- A interface deve ser limpa, objetiva e confortavel para uso diario.
- A personalidade visual vem do dominio do produto: rotas academicas,
  transporte, cobranca, documentos e operacao administrativa.
- O visual deve transmitir controle e clareza, sem efeitos chamativos.
- Nenhum refinamento visual pode alterar regra de negocio, contrato da API,
  backend, banco, migrations, integracoes Sicredi ou dados exibidos.
- A primeira escolha deve ser reutilizar tokens e componentes existentes.
- A interface deve funcionar bem em desktop, tablet e celular.

## 2. Identidade visual do produto

A assinatura visual do ATRETU usa uma linguagem de operacao e rota:

- marca forte na navegacao;
- acentos azul-profundo e verde-operacional;
- trilhos lineares discretos em KPIs, secoes e listas;
- icones em capsulas semanticas;
- cards com bordas suaves, sombra discreta e hierarquia clara;
- status visual baseado no dado real.

O produto nao deve parecer um template generico de dashboard. Cada modulo deve
parecer parte de um sistema especifico para gestao academica, transporte e
cobranca.

## 3. Personalidade da interface

- Profissional: neutra, bem alinhada e previsivel.
- Operacional: dados importantes aparecem primeiro e com peso visual maior.
- Serena: cores de alerta existem, mas nao dominam a tela.
- Precisa: textos curtos, labels claros e sem IDs tecnicos visiveis.
- Confiavel: estados de erro, vazio e loading devem ser tratados com cuidado.

Evitar:

- gradientes decorativos;
- efeitos exagerados;
- sombras pesadas;
- excesso de cor;
- cards todos iguais;
- textos longos dentro de elementos compactos;
- UUID, CPF, RG ou dados sensiveis em areas visuais.

## 4. Tokens do Admin

Os tokens visuais do Admin ficam em:

`apps/web/src/app/admin/admin-theme.ts`

Tokens atuais:

- `cx()`: helper para compor classes com condicionais simples.
- `appBackground`: fundo neutro do Admin.
- `atretuMark`: tratamento visual da marca ATRETU.
- `brandAccent`: acento principal para bordas.
- `card`: base dos cards administrativos.
- `cardHover`: hover sutil de cards interativos.
- `control`: selects e inputs administrativos.
- `focus`: foco visual consistente.
- `iconButton`: botoes quadrados de icone.
- `page`: largura util e espacamento do canvas.
- `primaryButton`: acao principal.
- `secondaryButton`: acao secundaria.
- `routeRail`: trilho visual discreto para composicoes operacionais.
- `softPanel`: painel auxiliar para filtros e blocos internos.
- `subtleText`: texto auxiliar.
- `titleText`: titulos internos.

Novos estilos do Admin devem ser adicionados a este arquivo somente quando
forem reutilizaveis. Nao criar tokens globais sem necessidade.

## 5. Tipografia

Usar a escala atual do Tailwind, sem criar fontes novas:

- Topbar: `text-lg font-semibold` para titulo da area.
- Titulo de pagina: `text-xl` a `text-2xl`, com peso forte.
- Titulo de secao: `text-base font-semibold`.
- Titulo de card/lista: `text-sm font-semibold`.
- Valor de KPI prioritario: `text-3xl font-bold`.
- Valor de KPI secundario: `text-xl font-bold`.
- Texto auxiliar: `text-sm` ou `text-xs`, com `leading-5`/`leading-6`.

Regras:

- Nao usar letter-spacing negativo.
- Nao escalar fonte por viewport width.
- Truncar ou quebrar textos longos de forma controlada.
- Reservar tamanhos grandes para dados realmente importantes.

## 6. Espacamento

Escala recomendada:

- Canvas: `gap-6`, `px-4 sm:px-6 lg:px-8`, `py-5`.
- Cards principais: `p-5`.
- Cards compactos: `p-4`.
- Itens de lista: `px-3 py-3`.
- Grids internos: `gap-3` ou `gap-4`.
- Separacao entre blocos maiores: `gap-6`.

Evitar cards comprimidos. Em mobile, reduzir peso visual sem esconder
informacao importante.

## 7. Grid e canvas

O canvas administrativo usa:

- largura maxima: `max-w-[1520px]`;
- layout em grid;
- conteudo centralizado;
- sem scroll horizontal.

Padroes:

- KPIs prioritarios: 1 coluna no mobile, 2 no tablet, 4 no desktop.
- KPIs secundarios: 1 coluna no mobile, 2 no tablet, 4 no desktop.
- Agenda e alertas: agenda maior no desktop, empilhado no mobile.
- Secoes operacionais: 2 ou 3 colunas no desktop, empilhadas no mobile.
- Graficos: 2 colunas no desktop, 1 coluna no mobile.

## 8. Sidebar

Componente:

`apps/web/src/app/admin/components/admin-sidebar.tsx`

Diretrizes:

- Desktop: sidebar fixa.
- Tablet: sidebar recolhivel.
- Mobile: usar drawer via `MobileNavigation`.
- Identidade ATRETU no topo.
- Usuario e sair no rodape.
- Item ativo com contraste forte e trilho/acento visual.
- Hover e foco visiveis.
- Permissoes preservadas por `canAccessRestrictedAdmin`.

Nunca:

- voltar para navegacao horizontal como principal;
- remover itens existentes sem aprovacao;
- exibir modulos restritos para usuario sem permissao.

## 9. Topbar

Componente:

`apps/web/src/app/admin/components/admin-topbar.tsx`

Diretrizes:

- Mostrar titulo da area ativa.
- Mostrar descricao curta quando houver.
- Preparar area visual de busca sem criar funcionalidade ficticia.
- Mostrar usuario autenticado.
- Incluir botao de menu mobile.
- Manter altura compacta.
- Usar fundo branco com leve transparencia e borda inferior suave.

## 10. Cards

Base:

`adminTheme.card`

Diretrizes:

- Radius: `rounded-xl`.
- Borda: suave, normalmente `slate-200/80`.
- Fundo: branco ou painel neutro.
- Sombra: discreta.
- Hover: apenas quando o elemento for interativo.
- Cards nao devem parecer todos iguais: usar hierarquia, icone, badge,
  marcador lateral ou trilho superior quando fizer sentido.

Nunca:

- colocar card dentro de card sem necessidade;
- usar sombra pesada;
- usar cores fortes como fundo dominante.

## 11. KPIs

Componente:

`DashboardKpiCard`

Diretrizes:

- Prioritarios têm valor maior, icone maior e trilho superior semantico.
- Secundarios têm menor peso visual.
- Todo KPI deve ter titulo, valor, contexto e status.
- Tendencias ou comparacoes so podem aparecer se existirem no contrato.
- Status deve ser calculado a partir do dado real.

KPIs prioritarios atuais:

- Academicos ativos.
- Valor vencido.
- Faturas vencidas.
- Pre-cadastros pendentes.

KPIs secundarios atuais:

- Boletos em atencao.
- Vagas ocupadas.
- Carteirinhas pendentes.
- Documentacao incompleta.

## 12. Badges e status

Componente:

`DashboardStatusBadge`

Tons oficiais:

- `success`: saudavel/concluido.
- `warning`: atencao.
- `danger`: critico.
- `info`: operacional/informativo.
- `neutral`: neutro.

Regras:

- Nao usar verde em todos os cards.
- O status precisa refletir o dado real.
- Critico deve aparecer antes de estados informativos.
- Badges devem ter texto curto.

## 13. Botoes

Tokens:

- `adminTheme.primaryButton`
- `adminTheme.secondaryButton`
- `adminTheme.iconButton`

Diretrizes:

- Botao primario: uma acao principal por bloco.
- Botao secundario: limpar, voltar, atualizar ou acao auxiliar.
- Botao apenas com icone precisa de `aria-label`.
- Sempre manter foco visivel.
- Desabilitado deve parecer claramente inativo.

## 14. Formularios

Token:

`adminTheme.control`

Diretrizes:

- Labels sempre visiveis.
- Select real para listas fechadas.
- ID tecnico nunca deve aparecer como texto para o usuario.
- UUID pode existir apenas como `value` interno.
- Erros devem ser claros e discretos.
- Loading de opcoes nao deve derrubar o restante da tela.

Exemplo aprovado:

`DashboardFilters`

## 15. Tabelas

Diretrizes para novos modulos:

- Cabecalho com contraste suave.
- Linhas com altura confortavel.
- Texto longo deve quebrar ou truncar sem estourar layout.
- Acoes de linha devem ser claras e acessiveis.
- Em mobile, preferir listas responsivas ou tabelas com tratamento especifico.
- Nao criar scroll horizontal indevido no viewport inteiro.

## 16. Listas

Componentes:

- `DashboardListCard`
- itens de lista com badge semantico;
- trilho lateral quando houver prioridade/status.

Diretrizes:

- Cada item deve ter titulo e contexto.
- Data e valor financeiro aparecem como metadados.
- Empty state compacto quando lista estiver vazia.
- Nao exibir dados sensiveis.

## 17. Graficos

Componente:

`DashboardChartCard`

Diretrizes:

- Usar HTML/CSS enquanto nao houver biblioteca aprovada.
- Mostrar titulo e contexto.
- Mostrar escala simples.
- Labels precisam ser legiveis.
- Barras devem ter track neutro e cor semantica.
- Empty state proprio quando nao houver dados.
- Em mobile, uma coluna e labels com quebra segura.

Nao instalar biblioteca de graficos sem aprovacao.

## 18. Empty states

Componente:

`DashboardEmptyState`

Diretrizes:

- Usar icone.
- Titulo curto quando o empty state for importante.
- Texto com orientacao clara.
- Nao ocupar area exagerada em listas internas.
- Nao parecer erro quando a ausencia de dados for normal.

## 19. Skeletons e loading

Diretrizes:

- Skeleton deve simular a estrutura real da tela.
- Loading inicial pode ocupar a tela inteira do Dashboard.
- Loading parcial nao deve bloquear secoes ja carregadas quando houver dados.
- Animacoes devem respeitar `motion-reduce`.

## 20. Cores semanticas

Paleta base:

- Fundo Admin: `#F3F6F8`.
- Marca profunda: `#0F2E2E`.
- Verde operacional: `#1F6F5F`.
- Verde suave: `#EEF7F4`, `#F2F8F6`, `#D8E9E4`.
- Neutros: escala Slate do Tailwind.
- Critico: Red.
- Atencao: Amber.
- Saudavel: Emerald.
- Informativo: verde operacional / sky apenas quando fizer sentido.

Regras:

- Evitar telas dominadas por uma unica cor.
- Usar cor para significado, nao decoracao.
- Nao usar gradientes decorativos.

## 21. Icones

Biblioteca:

`lucide-react`

Diretrizes:

- Importar apenas icones utilizados.
- Tamanho comum: 16, 18, 20 ou 22 px.
- Stroke comum: `2`.
- Icone nao substitui texto importante.
- Botao somente com icone exige `aria-label`.
- Capsulas de icone devem usar tom semantico controlado.

## 22. Motion

Diretrizes:

- Duracao curta: 150ms.
- Usar transicoes em hover, foco, background, borda e sombra.
- Movimento vertical maximo: `-translate-y-0.5`.
- Respeitar `motion-reduce`.
- Nao usar animacoes decorativas exageradas.

## 23. Acessibilidade

Obrigatorio:

- foco visivel em botoes, selects e links;
- `aria-label` em botoes de icone;
- `aria-current` em navegacao ativa;
- `role="progressbar"` em barras quando aplicavel;
- contraste adequado;
- navegacao por teclado;
- menu mobile fechavel por Escape;
- textos e alvos clicaveis com tamanho adequado.

## 24. Responsividade

Breakpoints praticos:

- Mobile: uma coluna, drawer de navegacao, textos com quebra segura.
- Tablet: sidebar recolhivel, grids de 2 colunas quando houver espaco.
- Desktop: sidebar fixa, canvas amplo, grids de 2 a 4 colunas.

Checklist:

- Sem scroll horizontal.
- Header nao deve empurrar os dados para longe no mobile.
- Cards nao devem ficar altos demais por texto longo.
- Botoes devem quebrar de forma elegante.

## 25. Componentes reutilizaveis atuais

Admin:

- `AdminSidebar`
- `AdminTopbar`
- `MobileNavigation`
- `DashboardFilters`

Dashboard:

- `DashboardKpiCard`
- `DashboardSection`
- `DashboardMetricStrip`
- `DashboardListCard`
- `DashboardChartCard`
- `DashboardStatusBadge`
- `DashboardEmptyState`
- `DashboardQuickShortcuts`

Navegacao:

- `admin-navigation.ts` centraliza itens, labels, descricoes, icones e chaves.

## 26. Quando reutilizar componente existente

Reutilizar quando:

- o novo modulo precisa de card, lista, badge, botao ou empty state semelhante;
- a interacao segue padrao ja aprovado;
- o estado visual pode ser expresso pelos tons oficiais;
- a estrutura do componente atende ao conteudo com pequenas props.

Antes de criar componente novo, verificar:

- `admin-theme.ts`;
- `components/dashboard-primitives.tsx`;
- componentes existentes do modulo Admin.

## 27. Quando criar novo componente

Criar novo componente quando:

- o novo modulo tem uma composicao propria e repetida;
- reaproveitar componente existente exigiria condicionais demais;
- ha nova responsabilidade visual clara;
- a abstracao reduz duplicacao real.

Regras:

- manter componente pequeno;
- nomear pelo papel visual ou operacional;
- usar tokens do Admin;
- nao acoplar regra de negocio ao componente visual;
- nao usar `any`.

## 28. Padroes que nunca devem ser quebrados

- Nao exibir UUID para o usuario.
- Nao exibir CPF, RG ou dados sensiveis em cards/listas de resumo.
- Nao criar chamada nova para montar metrica quando ja existe contrato aprovado.
- Nao instalar dependencia visual sem aprovacao.
- Nao alterar backend, contrato, banco, migrations ou Sicredi em tarefa de UI.
- Nao remover permissoes.
- Nao usar gradientes decorativos.
- Nao usar hover/focus invisivel.
- Nao criar scroll horizontal no viewport.
- Nao duplicar estilos em massa se houver token reutilizavel.
- Nao fazer todo modulo novo em um unico arquivo gigante.

## 29. Convencoes para novos modulos

Ao criar um novo modulo administrativo:

1. Definir a area em `admin-navigation.ts`.
2. Usar `AdminShell` e navegacao existentes.
3. Compor a pagina com `adminTheme.page`, `adminTheme.card` e tokens aprovados.
4. Usar cabecalho operacional compacto.
5. Usar filtros com labels claros e sem IDs tecnicos visiveis.
6. Usar badges semanticos.
7. Criar empty states com icone e orientacao.
8. Validar desktop, tablet e mobile.
9. Executar typecheck, testes e build.
10. Documentar novo padrao neste arquivo se ele for reutilizavel.

## 30. Checklist visual antes de concluir

- A tela parece parte do ATRETU?
- A hierarquia deixa claro o que importa primeiro?
- Status visual reflete dado real?
- Empty state parece intencional?
- Textos longos cabem?
- Foco por teclado aparece?
- Mobile nao tem scroll horizontal?
- A tela usa tokens do Admin?
- Nao ha dado sensivel?
- Typecheck, testes e build passaram?

