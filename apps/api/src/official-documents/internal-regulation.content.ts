import type { OfficialDocumentPdfBlock } from "./official-document-pdf.builder.js";

export const INTERNAL_REGULATION_APPROVAL_DATE = "2022-12-20";
export const INTERNAL_REGULATION_APPROVAL_TEXT =
  "Terra Rica, 20 de dezembro de 2022.";
export const INTERNAL_REGULATION_DOCUMENT_TITLE =
  "REGIMENTO INTERNO DA ASSOCIAÇÃO TERRARIQUENSE DOS ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS-ATRETU";

export function internalRegulationBody(): OfficialDocumentPdfBlock[] {
  return [
    {
      type: "paragraph",
      text: "A diretoria da ATRETU, no uso de sua prerrogativa, institui este Regimento Interno com atribuições específicas da Direção, dos seus Membros e associados, fornece diretrizes suplementares e outras providências de acordo e em complementação ao seu Estatuto Social.",
    },
    { type: "heading", text: "TÍTULO I" },
    { type: "heading", text: "DA ADMINISTRAÇÃO DA ASSOCIAÇÃO" },
    { type: "chapter", text: "CAPÍTULO I - Das disposições gerais" },
    {
      label: "Art. 1º",
      type: "article",
      text: "Este regimento interno tem por finalidade principal gerir questões pertinentes à administração da Associação dos Terrariquense dos Estudantes Técnicos e Universitários bem como nortear suas diretrizes para com o associado. Parágrafo único",
    },
    {
      label: "Art. 2º",
      type: "article",
      text: "Como princípio geral norteador deste regimento determina-se que a Direção da ATRETU deve sempre agir em prol do coletivo, proporcionando a todos os associados o tratamento igualitário de suas solicitações e a similaridade de tratamento na solução das suas questões.",
    },
    {
      label: "Art. 3º",
      type: "article",
      text: "O filiado ao ingressar no quadro associativo da ATRETU tomará conhecimento das disposições contidas neste regimento e no estatuto, obrigando-se a cumpri-las na sua totalidade, sob pena da aplicação das penalidades estabelecidas.",
    },
    { type: "chapter", text: "CAPÍTULO II - DA DIRETORIA" },
    {
      type: "section",
      text: "SEÇÃO I - De sua formação e deliberações complementares",
    },
    {
      label: "Art. 4º",
      type: "article",
      text: "A Diretoria é composta por:",
    },
    {
      items: [
        "I - Presidente;",
        "II - Vice-Presidente;",
        "III - 1º Secretário;",
        "IV - 2º Secretário;",
        "V - 1º Tesoureiro;",
        "VI - 2º Tesoureiro;",
      ],
      type: "list",
    },
    {
      label: "Art. 5º",
      type: "article",
      text: "Todos os eleitos do artigo anterior, exercerão as suas respectivas competências e atribuições durante o prazo determinado dos seus mandatos, conforme as descrições no Estatuto.",
    },
    {
      type: "paragraph",
      text: "Parágrafo único. O Presidente constatando que há abuso ou inércia de qualquer membro da Diretoria ou do Conselho Fiscal, deve imediatamente intervir em caráter transitório para sanar a causa da intervenção, procurando a solução mais adequada para a defesa dos interesses da ATRETU, a qual prevalecerá até apresentação de defesa escrita no prazo de até 10 dias úteis contados a partir da data do fato. Caso não seja aceito os argumentos que suportam a defesa, as sanções serão impostas pelo presidente com a ratificação da direção, em sede de reunião da mesma, até que se convoque assembleia para votação da destituição do membro infrator.",
    },
    {
      label: "Art. 6º",
      type: "article",
      text: "Contra as demais decisões da Diretoria cabe recurso à Assembleia Geral, que será convocada na forma dos Artigos 14, 15, e 18 do Estatuto da Associação.",
    },
    {
      label: "Art. 7º",
      type: "article",
      text: "Qualquer membro da Direção pode ser convocado a prestar esclarecimentos aos associados, podendo recusar, desde que tal solicitação não tenha sido devidamente protocolada na sede da ATRETU, que não diga respeito a matérias do foro privado deste e/ou da entidade.",
    },
    { type: "section", text: "SEÇÃO II - Das reuniões" },
    {
      label: "Art. 8º",
      type: "article",
      text: "Reunindo-se a Direção para deliberações acerca de qualquer matéria, estas serão determinadas por votação aqui declarada. Parágrafo único. A votação declarada contará com o voto verbalmente expresso pelos membros da direção, os quais serão lavrados na devida ata.",
    },
    {
      label: "Art. 9º",
      type: "article",
      text: "O Presidente poderá determinar que a reunião se estabeleça em caráter:",
    },
    { items: ["I - Aberto;", "II - Fechado;"], type: "list" },
    {
      label: "§1º",
      type: "article",
      text: "As reuniões realizadas de forma aberta, ou seja, sem sigilo, poderão ocorrer com a presença dos membros da ATRETU, representantes do Conselho Fiscal e Coordenadores e/ou associado cuja presença seja solicitada pela direção da ATRETU, por ser parte interessada no assunto a discutir, não tendo nenhum destes direito a voto nas deliberações.",
    },
    {
      label: "§2º",
      type: "article",
      text: "No caso da presença de associado, só será permitida enquanto estiver a ser discutido o assunto que é de seu interesse, ou da direção nessa discussão, tendo este de se retirar quando estiver discutido esse ponto e antes da votação se for caso disso.",
    },
    {
      label: "§3º",
      type: "article",
      text: "As reuniões realizadas de forma fechada, ou seja, em sigilo, ocorrerão visando:",
    },
    {
      items: [
        "I – Preservação de projetos;",
        "II – Resguardar a intimidade do filiado em questões de ordem administrativa ou pessoal que só a este diga respeito;",
        "III – Nos demais casos em que o presidente julgar necessário, resguardada tal decisão quando a imagem da ATRETU perante a comunidade assim requerer;",
      ],
      type: "list",
    },
    {
      label: "Art. 10º",
      type: "article",
      text: "O presidente constatando que algum membro da direção está agindo com excesso, deve convidá-lo a se retirar da reunião, escrevendo em ata o fato ocorrido. Parágrafo único. Se o membro se recusar a sair, deverá o presidente dar a reunião por encerrada, deliberando ou não nova convocação, e punindo o membro infrator nos termos deste regimento, com o devido registro em ata.",
    },
    {
      label: "Art. 11º",
      type: "article",
      text: "As reuniões ordinariamente ocorrerão uma vez por mês e extraordinariamente sempre que um dos membros convocar, com a aprovação do presidente, devendo seu motivo e a concordância constar em ata. §1º Havendo rejeição do Presidente, a reunião poderá ser convocada mediante maioria absoluta da Diretoria, representado por 1/5 (um quinto) de seus membros, a constar da ata.",
    },
    {
      label: "§1º",
      type: "article",
      text: "Havendo rejeição do Presidente, a reunião poderá ser convocada mediante maioria absoluta da Diretoria, representado por 1/5 (um quinto) de seus membros, a constar da ata.",
    },
    {
      label: "§2º",
      type: "article",
      text: "A diretoria deve comparecer a toda reunião ordinária.",
    },
    {
      label: "§3º",
      type: "article",
      text: "A Coordenação deverá se reunir ordinariamente 4 (quatro) vezes por ano com a diretoria",
    },
    {
      label: "§4º",
      type: "article",
      text: "O conselho fiscal deverá se reunir ordinariamente 4 (quatro) vezes por ano com a diretoria.",
    },
    {
      label: "§5º",
      type: "article",
      text: "As reuniões ordinárias do Conselho fiscal e Coordenação não devem coincidir no mesmo mês, salvo se necessário, por vontade do presidente ou a requerimento de 2/3 (dois terços) dos membros da Diretoria.",
    },
    {
      label: "§6º",
      type: "article",
      text: "O modelo de escala das reuniões será definido abaixo, sendo a sigla D (Diretoria), C (Coordenação) e CF (Conselho Fiscal). Jan. Fev. Mar. Abr. Mai. Jun. Jul. Ago. Set. Out. Nov. Dez. D D+C D+CF D D+C D+CF D D+C D+CF D D+C D+CF",
    },
    {
      label: "Art. 12º",
      type: "article",
      text: "Ao secretário caberá redigir e digitar as respectivas atas das reuniões, sem a necessidade de registro das mesmas em cartório específico, salvo atas de Assembleias Gerais.",
    },
    {
      label: "Art. 13º",
      type: "article",
      text: "O membro da Diretoria, Conselho Fiscal e da Coordenação que não comparecer nas reuniões ordinárias perderá o direito de receber o desconto de sua categoria no mês seguinte ao da reunião faltada, salvo por motivo relevante que deverá ser comunicado por escrito à ATRETU em até 03 (três) dias, e julgado pelo Presidente e Tesoureiro.",
    },
    {
      label: "Art. 14º",
      type: "article",
      text: "Cabe ao Presidente definir a data das reuniões ordinárias. Paragrafo único. O Presidente poderá alterar as datas das reuniões ordinárias depois de definidas, mediante prévio comunicado aos que irão participar da reunião, desde que esta alteração não venha a mudar a previsão do Art. 11, §6º do presente regimento interno.",
    },
    { type: "section", text: "SEÇÃO III - Dos atos da Direção" },
    {
      label: "Art. 15º",
      type: "article",
      text: "Das reuniões podem emanar:",
    },
    {
      items: [
        "I - Norma complementar;",
        "II - Instrução;",
        "III - Edital;",
        "IV - Avisos;",
      ],
      type: "list",
    },
    {
      label: "§1º",
      type: "article",
      text: "A norma complementar será utilizada para resolver questões administrativas de ordem geral e serão validadas pelo quórum de 2/3 (dois terços) dos membros da direção, para sua respectiva aprovação.",
    },
    {
      label: "§2º",
      type: "article",
      text: "A instrução é o ato pelo qual a direção impõe regras de utilização da associação e para aprovação necessita quórum de 2/3 (dois terços) de seus membros.",
    },
    {
      label: "§3º",
      type: "article",
      text: "Utilizar-se-á o edital para dar publicidade aos atos da direção bem como as convocações das Assembleias.",
    },
    {
      label: "§4º",
      type: "article",
      text: "Os avisos serão utilizados para comunicar os associados sobre quaisquer questões voltadas ao cotidiano e de que não dependam da formalidade dos demais atos contidos neste artigo.",
    },
    {
      label: "§5º",
      type: "article",
      text: "A eficácia de quaisquer destes atos independe de homologação em cartório, observada a exigibilidade de publicidade dos mesmos contendo as respectivas assinaturas.",
    },
    { type: "chapter", text: "CAPÍTULO III - Dos cofres" },
    {
      label: "Art. 16º",
      type: "article",
      text: "Assim que houver a posse, o presidente, o tesoureiro e o gestor administrativo- (caso houver) devem auditar as contas e elaborar um plano de administração financeira (orçamento), o qual guiará a ATRETU até o fim de sua legislatura.",
    },
    {
      label: "Art. 17º",
      type: "article",
      text: "Na elaboração deste plano deverá conter:",
    },
    {
      items: [
        "I - Os débitos incidentes e supervenientes;",
        "II - Os créditos incidentes e supervenientes;",
        "III - Valor em caixa;",
        "IV - Expectativa de créditos;",
        "V - Previsão de gastos por caso fortuito;",
        "VI - VI – Contabilização das execuções dos projetos;",
      ],
      type: "list",
    },
    {
      type: "paragraph",
      text: "Parágrafo único. O prazo para apresentar este plano é de 60 (sessenta) dias contados a partir da posse da nova diretoria.",
    },
    {
      label: "Art. 18º",
      type: "article",
      text: "A direção não poderá deixar de executar o orçamento pré-estabelecido, salvo caso de força maior. Parágrafo único. Todo ato praticado fora das determinações do plano de administração financeira é passível de anulação por Assembleia Geral, se provocar um desvio acima de 15% do previsto em orçamento.",
    },
    {
      label: "Art. 19º",
      type: "article",
      text: "Deverá ser criado um fundo de caixa para situações emergenciais que não poderá ser violado sem prévia autorização do Presidente e do Tesoureiro.",
    },
    {
      label: "Art. 20º",
      type: "article",
      text: "tesoureiro deve sempre resguardar o dinheiro em caixa bem como fazer uma análise dos investimentos propostos por qualquer outro membro.",
    },
    {
      label: "Art. 21º",
      type: "article",
      text: "O tesoureiro analisará o balanço mensal dos créditos e débitos feito pelo gestor administrativo e o encaminhará ao Conselho Fiscal. Parágrafo único. Na falta de um gestor administrativo para a Associação, o tesoureiro fará o balanço mensal dos créditos e débitos e o encaminhará ao Conselho Fiscal.",
    },
    { type: "chapter", text: "CAPITULO IV - DOS ASSOCIADOS" },
    {
      label: "Art. 22º",
      type: "article",
      text: "O interessado só será admitido como associado desde que preenchidos os requisitos dispostos no Art.38 do Estatuto da ATRETU. Parágrafo único. Submetendo-se o interessado a tais requisitos, sua associação se dará pelo Contrato de Compromisso elaborado pela Diretoria, tomando neste ato conhecimento de todas as regras, deveres, direitos e funcionamento da ATRETU",
    },
    {
      label: "Art. 23º",
      type: "article",
      text: "O associado que tiver dado causa, por qualquer conduta, à penalidade gravíssima com o consequente desligamento não poderá mais ser admitido ao quadro associativo da ATRETU, de acordo com o art. 44, do Estatuto Social da Associação.",
    },
    {
      type: "section",
      text: "SEÇÃO II - Da rescisão do vínculo com a Associação por ato unilateral do associado",
    },
    {
      label: "Art. 24º",
      type: "article",
      text: "O associado pode a qualquer tempo rescindir seu vínculo com a ATRETU.",
    },
    {
      label: "Art. 25º",
      type: "article",
      text: "Ao preencher o termo de desligamento o associado perde sua qualidade de associado na data estipulada no termo.",
    },
    {
      label: "Art. 26º",
      type: "article",
      text: "O termo de desligamento deverá conter o histórico de todas as mensalidades pendentes do associado para ciência do mesmo. Parágrafo único. Caso a data de desligamento estipulada no termo dure até a data de geração da próxima mensalidade, ou se na data acima mencionada já havia sido emitido boleto referente àquele mês, o associado estará obrigado a pagar a mensalidade gerada.",
    },
    { type: "section", text: "SEÇÃO III - Dos direitos dos associados" },
    {
      label: "Art. 27º",
      type: "article",
      text: "Aos associados assistem o direito de:",
    },
    {
      items: [
        "I - Requerimentos;",
        "II - Reclamações;",
        "III - Sugestões;",
        "IV - Elogios;",
        "V - Formular abaixo-assinados;",
        "VI – Apresentar projetos;",
        "VII – Colaborar nas iniciativas da ATRETU se for o seu autor ou proponente, ou se assim for solicitado pela direção pelas suas capacidades ou experiências;",
        "VIII – Participar das iniciativas da ATRETU;",
      ],
      type: "list",
    },
    {
      label: "§1º",
      type: "article",
      text: "As manifestações previstas nos incisos I, II, V e VI, deverão ser apresentadas por escrito, sendo que o presidente terá o prazo de 15 (quinze) dias para responder, fundamentadamente, contados a partir da data do protocolo.",
    },
    {
      label: "§2º",
      type: "article",
      text: "Se o documento for protocolado com pedido de urgência, o mesmo terá o prazo de 5 (cinco) dias para resposta.",
    },
    {
      label: "§3º",
      type: "article",
      text: "O presidente entendendo, no caso do parágrafo anterior, não ser caso de urgência responderá ao solicitado no prazo comum.",
    },
    { type: "section", text: "SEÇÃO IV Dos deveres dos associados" },
    {
      label: "Art. 28º",
      type: "article",
      text: "São deveres do associado:",
    },
    {
      items: [
        "I – O pagamento das contribuições mensais de forma regularizada;",
        "II - Obedecer ao Estatuto, ao Regimento Interno e às demais normas e decisões aprovadas pela direção;",
        "III - Respeitar os demais associados, bem como a instituição;",
        "IV - Comunicar a ATRETU com a específica antecedência, contida no Contrato de Compromisso, sobre eventuais alterações, cancelamentos, ou trancamentos de sua matrícula na respectiva instituição de ensino;",
        "V - Comunicar a administração da transgressão de qualquer dos incisos deste artigo;",
      ],
      type: "list",
    },
    { type: "section", text: "SEÇÃO V- Das Penalidades" },
    {
      label: "Art. 29º",
      type: "article",
      text: "O associado que transgredir as normas impostas pelo estatuto e por este regimento interno, estará sujeito às seguintes sanções a serem aplicadas pela Direção:",
    },
    {
      items: [
        "I – Advertência;",
        "II - Suspensão;",
        "III - Desligamento por Expulsão;",
      ],
      type: "list",
    },
    {
      label: "§1º",
      type: "article",
      text: "As sanções estipuladas nos incisos I, II e III do capítulo deste artigo poderão ser acumuladas.",
    },
    {
      label: "§2º",
      type: "article",
      text: "Aplicar-se-á advertência ao associado que incidir nas infrações estabelecidas em norma complementar específica, levando-se em conta seu histórico e a reincidência ou não desta conduta, sanção a ser imposta após deliberação em sede de reunião da diretoria com, no mínimo, 2/3 (dois terços) de seus membros.",
    },
    {
      label: "§3º",
      type: "article",
      text: "Transcorrido o prazo de um ano da infração cometida, o associado não será considerado reincidente nas condutas penalizadas por advertência.",
    },
    {
      label: "§4º",
      type: "article",
      text: "Aplicar-se-á a suspensão sempre que o associado já tiver contra si duas advertências, acumuladas, a qual será de cinco a trinta dias, a critério da direção, que deverá analisar a gravidade do fato conforme a redação de norma complementar em vigor, sanção a ser imposta após deliberação em sede de reunião da diretoria com, no mínimo, 2/3 (dois terços) de seus membros diretores.",
    },
    {
      label: "§5º",
      type: "article",
      text: "A expulsão será aplicada nos casos previstos no Art. 43, II, do Estatuto da Associação, ou quando o associado cumular contra si duas suspensões, combinadas ou não com advertência. Referida sanção será imposta após deliberação em sede de Reunião da Diretoria com o quórum de, no mínimo, 2/3 (dois terços) de seus membros e, obrigatoriamente, ratificada em Assembleia Geral Extraordinária, exigindo para tal maioria simples dos associados presentes.",
    },
    {
      label: "§6º",
      type: "article",
      text: "Das sanções de advertência, suspensão e/ou expulsão caberá, respeitado o direito de ampla defesa e do contraditório, recurso expresso e por escrito ao Presidente da ATRETU no prazo de 10 (dez) dias, sob pena de preclusão, a contar da data em que o associado tiver tomado conhecimento da notificação.",
    },
    {
      label: "Art. 30º",
      type: "article",
      text: "Qualquer associado, coordenador ou diretor, constatando infração do disposto no artigo anterior deste Regimento, deverá informar a administração da ATRETU relatando o ocorrido.",
    },
    {
      label: "Art. 31º",
      type: "article",
      text: "Caso chegue o acontecimento ao conhecimento dos diretores, os mesmos, em reunião, deverão aplicar a justa sanção.",
    },
    { type: "chapter", text: "CAPITULO VI - DO SOCIAL" },
    { type: "section", text: "Do Movimento Social" },
    {
      label: "Art. 33º",
      type: "article",
      text: "Regula o presente Capítulo o objeto social da ASSEFAR.",
    },
    {
      label: "Art. 34º",
      type: "article",
      text: "De acordo com o interesse geral, a conveniência do projeto de ordem social, educativo, estudantil e/ou desportivo poderá ser cobrado excepcionalmente um valor a fixar, que visa cobrir despesas com a referida ação que não possam ser assumidas pela Associação sob pena de por em risco a sua sustentabilidade.",
    },
    {
      label: "Art. 35º",
      type: "article",
      text: "Compete a ATRETU promover atividades sociais, que consistem em:",
    },
    {
      items: [
        "I – Exercer atividades paralelas, em conformidade com a lei, junto ao poder público;",
        "II – Promover eventos beneficentes em comunidades carentes;",
        "III – Oferecer palestras de incentivo para alunos de escolas públicas e/ou privadas;",
        "IV – Exercer serviços assistenciais, nas áreas em que os associados se graduam, bem como: saúde, jurídica, desportivas, pedagógicas, educacional, ambiental e cultural;",
        "V – Contribuir solidariamente com instituições filantrópicas e sociedade civil;",
        "VI – Promover ações de resgate e fortalecimento das culturas tradicionais;",
        "VII - Projetos de educação ambiental;",
        "VIII - Estimular voluntariamente o fornecimento de palestras e cursos em geral, desde que convenientes à oportunidade e as condições financeiras do momento;",
        "IX - Promover a cidadania",
      ],
      type: "list",
    },
    {
      type: "paragraph",
      text: "Parágrafo único. Os serviços assistenciais nos termos dos incisos deste artigo serão exercidos em conformidade com as leis e têm a exclusiva finalidade de prestar horas extracurriculares aos associados.",
    },
    {
      label: "Art. 36º",
      type: "article",
      text: "Qualquer associado pode propor projeto voltado para o social, desde que aprovado pela direção.",
    },
    {
      label: "Art. 37º",
      type: "article",
      text: "Os projetos apresentados à direção podem ser total ou parcialmente aprovados, ou não aprovados. Parágrafo único. Sendo parcialmente aprovado, o associado deverá ser consultado para anuir, ou não, a continuidade do seu projeto.",
    },
    { type: "heading", text: "DAS DISPOSIÇÕES FINAIS" },
    {
      label: "Art. 38º",
      type: "article",
      text: "As disposições deste Regimento Interno aplicam-se a todos associados e membros da direção, produzindo efeitos em todos os lugares onde as atividades da Associação estejam sendo disponibilizadas aos mesmos.",
    },
    {
      label: "Art. 39º",
      type: "article",
      text: "Os casos omissos ou duvidosos na interpretação deste regimento serão resolvidos pela Diretoria da ATRETU, com base nos princípios gerais de direito.",
    },
    {
      label: "Art. 40º",
      type: "article",
      text: "Qualquer alteração deste regimento deverá ser aprovada por, no mínimo, 2/3 (dois terços) dos votos dos presentes em reunião da diretoria, conforme previsão expressa no Art. 9º, § 2º e § 3º, do estatuto da associação. Parágrafo único. É de competência exclusiva da Direção a alteração deste Regimento Interno quando necessário, visando o interesse comum de todos os associados.",
    },
    {
      label: "Art. 43º",
      type: "article",
      text: "Este Regimento Interno entrará em vigor na data de sua aprovação e após exposto ou feita a sua divulgação.",
    },
  ];
}
