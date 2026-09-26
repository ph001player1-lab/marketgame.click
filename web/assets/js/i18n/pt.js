// Dicionário em português do Brasil: «lucro operacional», «aluguel»,
// «folha de pagamento», «cotas» para participações nas empresas,
// «facilitador». Valores em dólares no formato brasileiro: US$ 12.340.

export default {
  brand: 'Market Game',
  tagline: 'Rumo a novas águas — não à briga',

  common: {
    loading: 'Carregando…',
    retry: 'Tentar de novo',
    cancel: 'Cancelar',
    close: 'Fechar',
    save: 'Salvar',
    send: 'Enviar',
    done: 'Pronto',
    back: 'Voltar',
    yes: 'Sim',
    no: 'Não',
    ok: 'OK',
    month: 'Mês',
    monthOf: 'Mês {n} de {total}',
    notStarted: 'Não iniciado',
    finished: 'Encerrado',
    practice: 'Treino',
    rated: 'Vale para o ranking',
    notRated: 'Fora do ranking',
    copy: 'Copiar',
    copied: 'Copiado',
    signOut: 'Sair',
    myGames: 'Meus jogos',
    menu: 'Menu',
    you: 'Você',
    team: 'Equipe',
    teams: 'Equipes',
    total: 'Total',
    none: 'Nenhum',
    from: 'de',
    perMonth: '/mês',
    city: 'Cidade',
    private: 'Donos privados',
    sponsoredBy: 'Patrocínio',
    sponsorNote: 'O patrocinador não participa do jogo. Empréstimos, taxas e condições do jogo são fictícios e não são uma oferta de crédito.',
    serverTime: 'Horário do servidor',
    newTeam: 'Equipe nova',
    someone: 'Um jogador'
  },

  settings: {
    title: 'Configurações',
    language: 'Idioma',
    auto: 'Automático ({lang})',
    autoHint: 'Automático: dentro de um jogo, o idioma que o facilitador escolheu; no resto do site, o idioma do seu navegador. Sua escolha fica salva neste navegador.'
  },

  leagues: {
    start: 'Início', growth: 'Crescimento', elite: 'Elite',
    startWho: 'Para quem vai abrir um negócio',
    growthWho: 'Para donos de um negócio em funcionamento',
    eliteWho: 'Para executivos e equipes de gestão'
  },

  tabs: {
    business: 'Negócio', console: 'Painel', board: 'Placar', guide: 'Guia'
  },

  login: {
    title: 'Entrar',
    lead: 'Use o e-mail que o facilitador cadastrou no jogo. Vamos enviar um código de 6 dígitos — não precisa de senha.',
    email: 'E-mail',
    sendCode: 'Enviar código',
    codeSent: 'Enviamos um código de 6 dígitos para {email}. Ele vale por uma hora.',
    code: 'Código do e-mail',
    verify: 'Entrar',
    otherEmail: 'Usar outro e-mail',
    resend: 'Enviar um novo código',
    noEmail: 'Não chegou? Veja a pasta de spam ou peça ao facilitador para conferir o endereço.',
    testMode: 'Modo de teste: qualquer código de 6 dígitos funciona.'
  },

  home: {
    title: 'Meus jogos',
    playing: 'Jogos em que participo',
    hosting: 'Jogos que conduzo',
    noGames: 'Você ainda não está em nenhum jogo. O facilitador vai cadastrar seu e-mail em um jogo.',
    noHosted: 'Ainda não há jogos. Crie o primeiro.',
    newGame: 'Criar um jogo',
    open: 'Abrir',
    report: 'Relatório',
    place: '{place}º lugar de {rivals}',
    capital: 'Capital',
    multiplier: 'Multiplicador',
    share: 'Participação de mercado',
    hostsLink: 'Facilitadores',
    ratingLink: 'Ranking'
  },

  profile: {
    title: 'Boas-vindas ao jogo',
    lead: 'Conte às outras equipes quem vocês são. Elas veem seu nome e seu restaurante, nunca seu e-mail.',
    name: 'Seu nome',
    restaurant: 'Nome do restaurante',
    where: 'Onde vocês fazem negócios?',
    inState: 'Em um estado',
    multistate: 'Em vários estados dos EUA',
    international: 'Fora dos EUA',
    state: 'Estado',
    country: 'País',
    start: 'Começar a jogar',
    edit: 'Editar perfil'
  },

  header: {
    cash: 'Caixa',
    savings: 'Economias',
    timerOpen: 'As decisões fecham em',
    waiting: 'Aguardando o facilitador',
    impersonating: 'Visão do facilitador: você está jogando como {team}',
    backToConsole: 'Voltar ao painel'
  },

  notices: {
    title: 'Novidades para você',
    gotIt: 'Entendi',
    reason: 'Motivo: {reason}',
    anEmployee: 'funcionário',
    kinds: {
      fine: 'A cidade aplicou uma multa de {amount}.',
      grant: 'A cidade concedeu um subsídio de {amount}.',
      city_tax: 'A cidade cobrou uma taxa de {amount}.',
      stake_bought_city: 'Você comprou da cidade {pct} {inst} por {amount}. Sua parte do lucro chega todo mês.',
      stake_buyback: 'A cidade recomprou de você {pct} {inst} por {amount}.',
      stake_bought: 'Você comprou {pct} {inst} de {team} por {amount}.',
      stake_sold: 'Você vendeu {pct} {inst} para {team} por {amount}.',
      transfer: '{team} enviou {amount} para você.',
      employment: '{name} quer trabalhar para você como {job} por {salary} por mês.',
      credit: 'Seu limite de crédito agora é {amount}.',
      bankrupt: 'Seu restaurante ficou sem caixa e fechou. Escolha o que fazer agora.'
    }
  },

  upcoming: {
    title: 'A partir do próximo mês',
    keys: {
      ROUND_DURATION_MIN: 'Duração do mês, min', RENT: 'Aluguel', INSURANCE: 'Seguro',
      UTILITIES: 'Contas e outros', PAYROLL_BASE: 'Folha de pagamento', START_CAPITAL: 'Capital inicial',
      CIVIL_SERVICE_SALARY: 'Salário no emprego público', REOPEN_THRESHOLD: 'Economias para reabrir',
      P_REF: 'Preço de referência', MARKET_SIZE_PER_PLAYER: 'Mercado base, clientes',
      MARKET_QUALITY_GAIN: 'Crescimento do mercado por ponto de qualidade', LOAN_RATE_ANNUAL: 'Taxa de juros',
      LOAN_TERM_MONTHS: 'Prazo do empréstimo, meses', PROFIT_TAX_RATE: 'Imposto sobre o lucro'
    }
  },

  stats: {
    brand: 'Marca', reputation: 'Reputação', quality: 'Qualidade', capacity: 'Capacidade',
    guestsMo: 'clientes/mês', lossCf: 'Prejuízos a compensar antes do imposto'
  },

  decision: {
    title: 'Suas decisões para o mês {n}',
    closed: 'As decisões estão fechadas. Converse sobre estratégia com as outras equipes — o formulário abre quando o facilitador iniciar o mês.',
    notStarted: 'O jogo ainda não começou. O formulário abre quando o facilitador iniciar o mês 1.',
    over: 'O jogo terminou. Veja o resultado final no placar.',
    sent: 'Decisão enviada. Você pode mudá-la até o tempo acabar.',
    sentAt: 'Último envio: {time}',
    price: 'Preço por refeição',
    priceHint: 'Permitido de {min} a {max}. Acima de {soft} os clientes somem de uma vez.',
    marketing: 'Marketing — divida seu orçamento por canal',
    shifts: 'Turnos da equipe',
    shiftsMinus: 'Cortar um turno',
    shiftsSame: 'Sem mudança',
    shiftsPlus: 'Adicionar um turno',
    shiftsHint: 'Um turno = mais {cap} clientes de capacidade por {cost}/mês. Agora: turnos extras {shifts}, capacidade {capacity}.',
    quality: 'Investir em qualidade (uma vez)',
    qualityHint: '{unit} compra +1 ponto de qualidade (máximo 3). Manutenção de {upkeep}/mês por ponto. Comida melhor também faz o mercado inteiro crescer — a jogada do oceano azul.',
    priceWarTip: 'Abaixo do preço de referência cada cliente rende menos. Se todos os restaurantes baixam, ninguém ganha clientes e a cidade inteira perde dinheiro — veja «Oceano vermelho ou oceano azul» no Guia.',
    totalSpend: 'Gastos deste mês: {total} de {cash} em caixa',
    overCash: 'É mais do que você tem em caixa.',
    submit: 'Enviar decisão',
    resubmit: 'Atualizar decisão',
    perMonthPlaceholder: 'US$ neste mês',
    needed: 'Falta sua decisão'
  },

  channels: {
    seo: { name: 'SEO', blurb: 'Precisa de 3 meses seguidos para começar a funcionar. Depois se mantém com pouca manutenção.' },
    promo: { name: 'Divulgação na rua', blurb: 'Panfletos e promotores. Só funciona no mês em que você paga — parou de pagar, acabou.' },
    maps: { name: 'Google Maps', blurb: 'Começa a funcionar no mês seguinte ao pagamento e depois perde força devagar.' },
    social: { name: 'Redes sociais', blurb: 'Funciona na hora, mas as pessoas esquecem rápido. Mantenha a frequência.' },
    outdoor: { name: 'Outdoors', blurb: 'Uma veiculação (a partir de {min}) dura exatamente {months} meses e depois zera.' },
    affiliate: { name: 'Programa de fidelidade', blurb: 'Não traz clientes novos. Soma {bonus} à receita dos clientes que você atende enquanto você pagar pelo menos {min} por mês.' },
    badges: {
      seoRamp: '{n} de {total} meses', seoOn: 'funcionando', mapsOn: 'funcionando', socialOn: 'ativo',
      outdoorUntil: 'até o mês {n}', affiliateOn: 'ativo', off: 'desligado'
    }
  },

  pl: {
    title: 'Resultado do mês {n}',
    served: 'atendidos', lost: 'recusados',
    revenue: 'Receita', cogs: 'Custo dos alimentos e insumos', gross: 'Lucro bruto',
    rent: 'Aluguel', insurance: 'Seguro', utilities: 'Contas e outros', payroll: 'Folha de pagamento',
    shifts: 'Turnos extras', qualityUpkeep: 'Manutenção da qualidade', qualityInvest: 'Investimento em qualidade',
    marketing: 'Marketing', ebit: 'Lucro operacional', interest: 'Juros do empréstimo',
    pbt: 'Lucro antes do imposto', tax: 'Imposto sobre o lucro', profit: 'Lucro líquido',
    principal: 'Amortização do empréstimo', cashFlow: 'Fluxo de caixa', dividends: 'Dividendos das suas cotas',
    cashAfter: 'Caixa no fim do mês', share: 'Participação de mercado', byChannel: 'Marketing por canal',
    none: 'Ainda não há resultados — eles aparecem depois do primeiro mês.'
  },

  bank: {
    title: 'Banco',
    balance: 'Saldo devedor', rate: 'Taxa', nextPayment: 'Próxima parcela (amortização + juros)',
    termLeft: 'Parcelas restantes', available: 'Disponível para empréstimo', limit: 'Limite de crédito',
    noCredit: 'O crédito não está disponível agora.',
    borrow: 'Pegar empréstimo', repay: 'Quitar antecipadamente', amount: 'Valor, US$',
    note: 'O banco do jogo é fictício. Seu capital é o caixa menos o empréstimo: pegar dinheiro emprestado, por si só, não deixa você mais rico.',
    capital: 'Seu capital (caixa − empréstimo)',
    received: 'Empréstimo recebido: {amount}.',
    repaid: 'Você quitou {amount}.'
  },

  transfer: {
    title: 'Enviar dinheiro para outra equipe',
    lead: 'Sai do seu caixa. Serve para acordos, para ajudar um aliado ou para comprar parte do negócio dele.',
    to: 'Destinatário', amount: 'Valor, US$', send: 'Enviar', nobody: 'Ainda não há outras equipes.',
    sent: 'Você enviou {amount} para {team}.'
  },

  stakes: {
    title: 'Suas cotas',
    lead: 'Você é dono de uma parte destas empresas e recebe todo mês sua parte do lucro delas.',
    none: 'Você não tem cotas. A cidade pode vender a você parte do locador, do banco, da seguradora ou da concessionária — fale com o facilitador.',
    lastMonth: 'no mês passado: {amount}'
  },

  institutions: {
    landlord: 'Locador', bank: 'Banco', insurer: 'Seguradora', utility: 'Concessionária',
    landlordWhat: 'é dono dos imóveis dos restaurantes, recebe o aluguel',
    bankWhat: 'empresta dinheiro, recebe juros, perde os empréstimos não pagos',
    insurerWhat: 'recebe os prêmios de seguro',
    utilityWhat: 'luz, água, lixo, taxas de cartão e outros serviços'
  },

  // A empresa dentro da frase: «10% do locador».
  institutionsOf: {
    landlord: 'do locador', bank: 'do banco', insurer: 'da seguradora', utility: 'da concessionária'
  },

  employees: {
    title: 'Seus funcionários',
    wants: '{name} quer trabalhar para você como {job} por {salary}/mês',
    approve: 'Contratar', reject: 'Recusar', pay: 'Pagar {salary}', paid: 'Pago neste mês',
    approved: 'Trabalha para você'
  },

  career: {
    title: 'Fechar o negócio e fazer outra coisa',
    lead: 'Você fica com o caixa depois de quitar o empréstimo. Se o empréstimo for maior que o caixa, você sai sem dívida — o prejuízo é do banco. O restaurante fecha para sempre; depois você pode abrir outro.',
    civil: 'Emprego público', civilWhat: '{salary}/mês do orçamento da cidade, automaticamente.',
    freelance: 'Autônomo', freelanceWhat: 'Viver de transferências de outras equipes. Negocie.',
    custom: 'Ser contratado', customWhat: 'Diga qual é o seu ofício e ofereça a uma equipe em troca de salário.',
    end: 'Sair do jogo', endWhat: 'Você para de jogar. Suas cotas voltam para a cidade.',
    profession: 'Seu ofício, ex.: Chef', confirm: 'Confirmar',
    confirmClose: 'Fechar o restaurante e passar para «{path}»? Não dá para desfazer.',
    confirmEnd: 'Sair do jogo de vez?'
  },

  life: {
    bankruptTitle: 'Seu restaurante ficou sem caixa',
    bankruptLead: 'O negócio fechou. Escolha o que fazer agora — você pode voltar com um restaurante novo quando juntar {threshold}.',
    civilTitle: 'Você tem um emprego público',
    freelanceTitle: 'Você está trabalhando como autônomo',
    customTitle: 'Você trabalha como {job}',
    savings: 'Economias', threshold: 'Necessário para reabrir', toReopen: 'Para abrir um restaurante novo você precisa de {threshold}',
    reopen: 'Abrir um restaurante novo', reopenWhat: 'Recomeço do zero: marca, reputação, qualidade e propaganda começam do zero. Suas economias viram o caixa do novo negócio.',
    salary: 'Salário de {salary}/mês, pago no cálculo de cada mês.',
    offer: 'Ofereça seu trabalho a uma equipe', employer: 'Equipe', salaryAsk: 'Salário mensal, US$',
    offerSend: 'Enviar proposta', offerPending: 'Aguardando a resposta de {team}.',
    offerApproved: 'Você trabalha para {team} por {salary}/mês.', paidThisMonth: 'Pago neste mês.',
    switchPath: 'Mudar de caminho',
    leftTitle: 'Você saiu deste jogo',
    leftLead: 'Obrigado por jogar! Você ainda pode acompanhar o placar.'
  },

  board: {
    title: 'Placar',
    views: { teams: 'Equipes', economy: 'Economia', money: 'Para onde foi o dinheiro', rating: 'Ranking' },
    metrics: {
      capital: 'Capital', cash: 'Caixa', profit: 'Lucro', marketSharePct: 'Participação de mercado', served: 'Clientes atendidos',
      price: 'Preço', brand: 'Marca', reputation: 'Reputação', quality: 'Qualidade',
      capacity: 'Capacidade', marketingTotal: 'Propaganda', qualityInvest: 'Investimento em qualidade',
      tax: 'Imposto sobre o lucro', dividends: 'Dividendos'
    },
    metricNotes: {
      capital: 'O caixa menos o que a equipe ainda deve ao banco; as economias, para equipes fora do negócio. Vence o maior capital no fim.',
      cash: 'Dinheiro no caixa do restaurante no fim do mês, sem descontar empréstimos. Para equipes fora do negócio, as economias.',
      profit: 'Lucro líquido depois de juros e imposto. Para equipes fora do negócio, a renda.',
      marketSharePct: 'Parte de todos os clientes da cidade que o restaurante atendeu.',
      served: 'Clientes atendidos; quem não coube foi recusado.',
      price: 'Preço por refeição.',
      brand: 'De 0 a 3. Cresce com clientes satisfeitos e se desgasta todo mês.',
      reputation: 'De 0,6 a 1,0. Cai quando clientes são recusados.',
      quality: 'De 0 a 3. Comprada com investimento, se desgasta devagar.',
      dividends: 'Parte do lucro das cotas do locador, do banco, da seguradora e da concessionária.'
    },
    metric: 'Mostrar',
    you: '(você)',
    legend: 'Equipes — clique em uma para destacá-la',
    otherTeams: 'Outras equipes',
    offBusiness: 'fora do negócio',
    mo: 'Mês',
    chartLabel: '{metric} por mês de {n} equipes. O botão Tabela mostra os números exatos.',
    showTable: 'Tabela',
    showChart: 'Gráfico',
    afterMonth: 'Depois do mês {n}',
    beforeStart: 'Antes do mês 1',
    market: 'mercado de {guests} clientes',
    teamsCount: '{n} equipes',
    teamsCount_one: '{n} equipe',
    empty: 'Ainda não há resultados — o placar se preenche depois do primeiro mês.',
    standings: 'Classificação',
    capital: 'Capital',
    lastMonth: 'Último mês',
    share: 'Participação',
    guests: 'Clientes',
    marketTitle: 'Tamanho do mercado, clientes por mês',
    marketWhy: 'Começa com {base} clientes por mês. Cresce {gain} para cada ponto de qualidade média na cidade. Preços médios baixos trazem mais clientes; altos, menos.',
    cityTitle: 'Orçamento da cidade',
    cityBalance: 'Saldo {amount}',
    cityWhat: 'Receitas acima do zero, despesas abaixo. A cidade arrecada o imposto sobre o lucro, multas, taxas municipais, sua parte do lucro das empresas e o dinheiro da venda de cotas. Ela paga subsídios, salários do emprego público e recompras de cotas.',
    citySeries: {
      profitTax: 'Imposto sobre o lucro', companies: 'Parte do lucro das empresas',
      otherIncome: 'Multas, taxas municipais, venda de cotas', spending: 'Subsídios, salários, recompras'
    },
    cityIncome: {
      profitTax: 'Imposto sobre o lucro', fines: 'Multas', cityTaxes: 'Taxas municipais',
      dividends: 'Parte do lucro das empresas', stakeSales: 'Venda de cotas'
    },
    citySpending: { grants: 'Subsídios', civilSalaries: 'Salários do emprego público', stakeBuybacks: 'Recompra de cotas' },
    net: 'Líquido',
    balance: 'Saldo',
    balanceTitle: 'Saldo da cidade',
    ownership: 'Donos',
    teamOwners: 'Equipes',
    holders: 'Cotas das equipes',
    noHolders: 'Nenhuma equipe tem cotas ainda.',
    instTotals: 'Receita {income} · pago aos donos {payout}',
    writeOffsTotal: 'empréstimos não pagos baixados {amount}',
    loansNow: 'empréstimos em aberto {amount}',
    lossCf: 'prejuízos a compensar antes de pagar os donos {amount}',
    income: 'Receita', profitInst: 'Lucro', writeOffs: 'Baixado', payout: 'Pago aos donos',
    loans: 'Empréstimos em aberto',
    noPayout: 'Nenhum lucro distribuído neste mês',
    payoutChart: '{name}: lucro pago aos donos por mês',
    payoutChartShort: 'Lucro pago aos donos',
    ratingTitle: 'Ranking da liga {league}',
    ratingFull: 'Ranking completo',
    joinAt: 'As equipes entram em',
    code: 'Código do jogo',
    open: 'Abrir o placar',
    fullscreen: 'Tela cheia',
    rotate: 'Alternar as visões a cada 20 segundos',
    decisionsOpen: 'decisões abertas',
    signInLead: 'O placar é só para as equipes deste jogo, o facilitador e os administradores. Entre com seu e-mail para exibi-lo.'
  },

  ocean: {
    title: 'Oceano vermelho ou oceano azul?',
    lead: 'Águas vermelhas: os restaurantes da cidade perdem dinheiro juntos — quase sempre por uma guerra de preços, uma corrida de propaganda ou restaurantes demais para os clientes que existem. Águas azuis: eles ganham juntos. A vitória continua sendo da equipe com mais capital, mas em águas azuis há mais capital a conquistar.',
    water: { red: 'Águas vermelhas', choppy: 'Águas agitadas', blue: 'Águas azuis' },
    earned: 'A cidade ganhou', lost: 'A cidade perdeu',
    summary: {
      earned: 'Mês {n}: juntos, os restaurantes ganharam {amount} sobre vendas de {revenue} ({pct}).',
      lost: 'Mês {n}: juntos, os restaurantes perderam {amount} sobre vendas de {revenue} ({pct}).'
    },
    driversTitle: 'O que mexeu com a água',
    driver: {
      priceWar: 'Guerra de preços no mês {n}: o preço médio foi {avg}, abaixo da referência de {ref} — cada cliente rendeu menos para todos.',
      priceOk: 'Sem guerra de preços no mês {n}: o preço médio foi {avg} (referência {ref}).',
      adRace: 'Corrida de propaganda no mês {n}: a propaganda levou {share} de todas as vendas — os anúncios mais trocam clientes de um restaurante para outro.',
      adOk: 'Sem corrida de propaganda no mês {n}: a propaganda levou {share} das vendas.',
      crowded: 'Restaurantes demais no mês {n}: foram {guests} clientes para {restaurants} — a um preço justo isso sustenta com lucro só cerca de {feeds}.',
      roomy: 'Há espaço no mês {n}: foram {guests} clientes para {restaurants} — a um preço justo isso sustenta com lucro cerca de {feeds}.',
      feedsHow: 'Como calculamos: a {ref}, cada cliente deixa {perGuest} depois do custo dos alimentos; então um restaurante precisa de cerca de {breakEven} clientes por mês para cobrir {fixed} de custos fixos. {guests} ÷ {breakEven} ≈ {feeds}.',
      quality: 'A qualidade fez o mercado crescer no mês {n}: a qualidade média da cidade foi {quality} de 3, então vieram {boost} mais clientes do que viriam sem nenhuma qualidade — cerca de {extra} clientes extras, divididos entre todos os restaurantes.',
      noQuality: 'Ainda não há qualidade no mês {n}: a qualidade média da cidade é 0. Cada ponto de qualidade média traz cerca de {gain} mais clientes — para todos os restaurantes, não só para quem investiu.'
    },
    nRestaurants: '{n} restaurantes',
    nRestaurants_one: '{n} restaurante',
    feedsNote: '«Sustenta com lucro» — quantos restaurantes os clientes daquele mês conseguiriam manter no lucro ao preço de referência: clientes ÷ quantos clientes um restaurante precisa para cobrir seus custos fixos.',
    chartTitle: 'Resultado operacional de todos os restaurantes por mês',
    guideHint: 'Como deixar as águas azuis — veja «Oceano vermelho ou oceano azul» no Guia.',
    columns: {
      restaurants: 'Restaurantes', guests: 'Clientes', feeds: 'Sustenta com lucro', avgPrice: 'Preço médio', adShare: 'Propaganda / vendas',
      quality: 'Qualidade média', result: 'Resultado operacional', margin: 'Margem', water: 'Águas'
    },
    debriefTitle: 'Debate depois do mês {n}',
    questionsTitle: 'Perguntas para as equipes',
    questions: {
      red: [
        'O que deixou as águas vermelhas neste mês: os preços, a propaganda ou restaurantes demais?',
        'Quem ganhou com os descontos — e quem pagou por eles?',
        'O que as equipes podem fazer juntas para que a cidade inteira ganhe no próximo mês?'
      ],
      choppy: [
        'A cidade mal chega ao zero a zero. O que a levaria ao vermelho — ou ao azul?',
        'Alguém está começando uma guerra de preços ou uma corrida de propaganda?',
        'O que as equipes podem fazer juntas para que a cidade inteira ganhe mais?'
      ],
      blue: [
        'O que manteve as águas azuis neste mês?',
        'O que pode deixá-las vermelhas no próximo mês — e como evitar isso?',
        'Onde mais podemos fazer o mercado crescer em vez de brigar por ele?'
      ]
    },
    empty: 'A cor da água aparece depois do primeiro mês.'
  },

  money: {
    title: 'Para onde foi o dinheiro',
    lead: 'Todo o dinheiro que os clientes pagaram neste jogo e onde ele foi parar. Passe o mouse ou toque em um fluxo para ver os detalhes.',
    guests: 'Clientes', restaurants: 'Restaurantes', losses: 'Capital e empréstimos',
    suppliers: 'Alimentos e insumos', staff: 'Equipe de trabalho', advertising: 'Propaganda', quality: 'Qualidade',
    landlord: 'Locador', insurer: 'Seguradora', utility: 'Concessionária', bank: 'Banco (juros)',
    cityTax: 'Cidade (imposto sobre o lucro)', kept: 'Ficou com os restaurantes',
    ofGuests: 'do dinheiro dos clientes',
    groupCost: 'Custos dos restaurantes', groupInstitutions: 'Locador, seguradora, concessionária, banco',
    groupCity: 'Cidade', groupKept: 'Lucro dos restaurantes', groupLosses: 'Prejuízos cobertos com capital e empréstimos',
    flow: 'Fluxo', amount: 'Valor', share: 'Parte',
    ownersTitle: 'Quem ficou com o lucro das empresas',
    ownersLead: 'O locador, o banco, a seguradora e a concessionária receberam {amount} dos restaurantes. O lucro delas vai para os donos.',
    city: 'Cidade', players: 'Equipes cotistas', private: 'Donos privados',
    retained: 'Cobriram prejuízos e empréstimos não pagos',
    cityGot: 'A cidade arrecadou imposto sobre o lucro {tax}, multas e taxas municipais {fines}, venda de cotas {stakes}.',
    cityPaid: 'A cidade pagou subsídios {grants}, salários do emprego público {salaries}, recompras de cotas {buybacks}.',
    betweenTeams: 'As equipes enviaram entre si {amount}.',
    empty: 'O mapa do dinheiro aparece depois do primeiro mês.'
  },

  rating: {
    title: 'Ranking',
    lead: 'Todos os jogos da liga que valem para o ranking. Pontuação = 0,7 × multiplicador de capital médio + 0,9 × nota média de colocação.',
    howTitle: 'Como funciona o ranking',
    how1: 'Multiplicador de capital = capital no fim do jogo ÷ capital inicial. Capital é o dinheiro menos o que a equipe ainda deve ao banco.',
    how2: 'A nota de colocação é 1 para o primeiro lugar, 0 para o último e um valor intermediário para os demais.',
    how3: 'Um jogo vale quando é jogado até o último mês da liga e não é de treino.',
    how4: 'Uma equipe conta em um jogo quando jogou pelo menos três quartos dos meses: 9 de 12, 18 de 24, 27 de 36.',
    leagueLabel: 'Liga',
    months: '{n} meses',
    filter: 'Onde',
    all: 'Em todo lugar',
    multistate: 'Em vários estados dos EUA',
    usShort: 'EUA',
    international: 'Fora dos EUA',
    gamesList: '{n} jogos',
    gamesList_one: '{n} jogo',
    gameLine: '{place}º lugar de {rivals}, {capital}, ×{mult}',
    columns: { team: 'Equipe', where: 'Onde', games: 'Jogos', wins: 'Vitórias', mult: '× médio', place: 'Nota de colocação', share: 'Participação média', score: 'Pontuação' },
    empty: 'Ainda não há jogos válidos para o ranking nesta liga.'
  },

  host: {
    console: 'Painel do facilitador',
    run: 'Jogo', teams: 'Equipes', cityTab: 'Cidade', settings: 'Configurações',
    boardLink: 'Placar para o projetor',
    copyBoardLink: 'Copiar link',
    signInHint: 'As equipes entram em {site} com o e-mail que você cadastrou e um código de 6 dígitos que chega por e-mail.',
    notStartedTitle: 'Pronto para começar',
    monthOpen: 'O mês {n} está aberto',
    monthDone: 'O mês {n} de {total} foi calculado',
    gameOver: 'O jogo terminou',
    openMonth: 'Abrir o mês {n}',
    opened: 'O mês {n} está aberto. O cronômetro está correndo.',
    monthLength: '{minutes} min por mês',
    calcMonth: 'Calcular o mês {n}',
    calculated: 'O mês {n} foi calculado.',
    confirmCalc: 'Calcular o mês {n} agora? Equipes sem decisão: {waiting} — a última decisão delas vai se repetir.',
    submitted: 'Decisões enviadas: {n} de {total}',
    addTeamsFirst: 'Primeiro cadastre os e-mails das equipes — na aba Equipes.',
    profilesPending: 'Equipes que ainda não preencheram nome e restaurante: {n}. Elas podem fazer isso enquanto o mês 1 estiver aberto.',
    finish: 'Encerrar o jogo e atualizar o ranking',
    finishEarly: 'Encerrar o jogo agora? Ele termina antes do mês {total}, então não vai valer para o ranking.',
    finishConfirm: 'Encerrar o jogo e atualizar o ranking?',
    finishedRated: 'O jogo terminou e vale para o ranking.',
    finishedUnrated: 'O jogo terminou. Ele não vale para o ranking.',
    openReport: 'Abrir o relatório',
    playAgain: 'Jogar de novo com as mesmas equipes',
    playAgainConfirm: 'Criar um jogo novo com as mesmas equipes e configurações?',
    created: 'Jogo criado. Código {code}.',
    rosterTitle: 'Equipes',
    rosterLead: 'Uma equipe — um e-mail. Cole a lista: quebras de linha, vírgulas ou espaços funcionam. A lista é o elenco completo: os e-mails que você tirar saem do jogo, a menos que a equipe já tenha jogado.',
    rosterEmails: 'E-mails das equipes',
    rosterSave: 'Salvar elenco',
    rosterResult: 'Elenco salvo: {added} adicionados, {removed} removidos.',
    rosterNotes: 'Sem alteração:',
    rosterWhy: {
      not_email: 'não é um endereço de e-mail',
      host: 'o facilitador não pode jogar no próprio jogo',
      repeated: 'repetido',
      played: 'já jogou — removê-la quebraria o histórico do jogo'
    },
    teamsTitle: 'Equipes no jogo ({n})',
    noTeams: 'Ainda não há equipes.',
    viewAs: 'Jogar como',
    viewAsLead: '«Jogar como» abre a tela de uma equipe: veja o que ela vê ou jogue por ela em um treino.',
    profilePending: 'Perfil ainda não preenchido',
    columns: { team: 'Equipe', money: 'Caixa / economias', brand: 'Marca', capacity: 'Capacidade', loan: 'Empréstimo', sent: 'Enviou' },
    cityLead: 'Você joga como a cidade. Multas, taxas e venda de cotas entram no orçamento da cidade; subsídios, salários do emprego público e recompras saem dele.',
    lastMonthNet: 'Último mês, líquido',
    adjustTitle: 'Multa ou subsídio para uma equipe',
    amount: 'Valor, US$', reason: 'Motivo', reasonPlaceholder: 'A equipe vai ver',
    fine: 'Multa', grant: 'Subsídio', fined: 'Multa aplicada.', granted: 'Subsídio pago.',
    pickTeam: 'Escolha uma equipe.',
    massTitle: 'Todos de uma vez',
    massHint: 'Por equipe.',
    taxAll: 'Cobrar taxa de cada restaurante aberto', grantAll: 'Dar subsídio a todos fora do negócio',
    confirmTaxAll: 'Cobrar {amount} de cada restaurante aberto?',
    confirmGrantAll: 'Dar {amount} a cada equipe fora do negócio?',
    massDone: 'Pronto: equipes {n}, {total} no total.',
    sharesTitle: 'Participação da cidade',
    sharesLead: 'Quanto de cada empresa pertence à cidade. O resto é das equipes (cotas) e de donos privados. Todo mês a cidade recebe sua parte do lucro de cada empresa.',
    cityPct: 'A cidade tem, %',
    cityShareSaved: 'Agora a cidade tem {pct} {inst}.',
    stakesTitle: 'Cotas',
    stakesLead: 'Venda para uma equipe parte do que é da cidade, recompre ou registre um acordo entre equipes. A equipe paga ou recebe o preço na hora; os dividendos chegam todo mês.',
    sell: 'A cidade vende', buyback: 'A cidade recompra', deal: 'Acordo entre equipes',
    company: 'Empresa', buyer: 'Comprador', seller: 'Vendedor', holder: 'Da equipe',
    pct: 'Participação, %', price: 'Preço, US$',
    stakeHint: 'Nos últimos meses cada 1% pagou cerca de {perPct} por ano. Meses restantes: {left} — {pct} pagaria cerca de {est} até o fim.',
    cityOwns: 'A cidade tem {pct}.',
    stakeSubmit: 'Registrar',
    stakeDone: 'Cota registrada.',
    confirmStake: {
      sell: 'Vender {pct} {inst} para {buyer} por {price}?',
      buyback: 'Recomprar {pct} {inst} de {seller} por {price}?',
      deal: '{seller} vende {pct} {inst} para {buyer} por {price}?'
    },
    gameInfo: 'Dados do jogo',
    language: 'Idioma do jogo',
    languageHint: 'Todos veem o jogo neste idioma, a menos que escolham outro no menu.',
    title: 'Nome do jogo', titlePlaceholder: 'ex.: Câmara de Austin, turma de outono',
    organizer: 'Organizador', organizerPlaceholder: 'ex.: Câmara de Comércio de Austin',
    scheduled: 'Data e hora', scheduledHint: 'No fuso horário do jogo.',
    timezone: 'Fuso horário',
    openBook: 'Depois do final, mostrar a todos as decisões de cada equipe',
    practiceLabel: 'Jogo de treino — não vale para o ranking',
    practiceLocked: 'Não dá para mudar depois do mês 1.',
    league: 'Liga',
    leagueFixed: 'Liga {league} · {total} meses. A liga é definida na criação do jogo.',
    sponsorTitle: 'Patrocinador (opcional)',
    sponsorLead: 'Aparece no placar como um anúncio claramente identificado. O patrocinador não participa do jogo.',
    sponsorName: 'Nome do patrocinador', sponsorUrl: 'Site (https://…)',
    logo: 'Logotipo', logoUpload: 'Enviar arquivo do logotipo', logoRemove: 'Remover', logoNone: 'Sem logotipo',
    logoLink: 'Ou cole o link da imagem', logoPreviewAlt: 'Prévia do logotipo',
    logoWorking: 'Preparando o logotipo…', logoReady: 'Logotipo pronto — ele fica salvo com o jogo.',
    logoFileBad: 'Não conseguimos ler esse arquivo. Use uma imagem PNG, JPG, WebP ou SVG.',
    logoChecking: 'Verificando o link…', logoOk: 'O link abre como imagem.',
    logoBad: 'Este link não abre como imagem. Envie o arquivo ou use um link direto para um PNG, JPG ou SVG. Um arquivo do Google Drive precisa estar compartilhado com «Qualquer pessoa com o link».',
    logoHint: 'PNG, JPG, WebP ou SVG de qualquer tamanho: cortamos as bordas vazias e reduzimos para a web. Fundo transparente fica melhor. Enviar o arquivo é o jeito mais seguro.',
    saved: 'Salvo.',
    economy: 'Economia',
    settingsLead: 'As mudanças valem a partir do próximo mês, para que as equipes decidam com os números pelos quais serão avaliadas.',
    allowed: 'Permitido: {range}',
    configSave: 'Salvar para o próximo mês',
    configSaved: 'Salvo. Vale a partir do próximo mês.',
    configWhy: {
      not_editable: 'não pode ser alterado',
      not_number: 'não é um número',
      not_whole: 'precisa ser um número inteiro',
      range: 'permitido de {min} a {max}'
    },
    badNumber: 'Confira o número de «{name}».',
    nothingChanged: 'Nada mudou.',
    dangerTitle: 'Excluir o jogo',
    deleteLead: 'Só é possível excluir um jogo sem meses calculados.',
    delete: 'Excluir jogo',
    deleteConfirm: 'Excluir este jogo de vez?',
    deleted: 'Jogo excluído.',
    createTitle: 'Criar um jogo',
    createLead: 'Depois você vai cadastrar os e-mails das equipes e abrir o mês 1.',
    create: 'Criar jogo'
  },

  admin: {
    title: 'Facilitadores',
    lead: 'Facilitadores criam e conduzem jogos. Os administradores são definidos nas configurações do projeto (ADMIN_EMAILS).',
    add: 'Adicionar facilitador', email: 'E-mail do facilitador', addHint: 'Ele entra com este e-mail e um código — sem senha.',
    added: '{email} agora é facilitador.', remove: 'Remover', removed: '{email} não é mais facilitador.',
    removeConfirm: 'Remover {email} dos facilitadores? Os jogos dele continuam.',
    admins: 'Administradores', adminsNote: 'Administradores podem conduzir qualquer jogo e nomear facilitadores.',
    hosts: 'Facilitadores', none: 'Ainda não há facilitadores.'
  },

  history: {
    title: 'Relatório do jogo',
    running: 'O jogo ainda está em andamento — este relatório se atualiza conforme os meses são calculados.',
    summary: 'Seu resultado',
    place: 'Colocação',
    noMonths: 'Nenhum mês jogado ainda.',
    stakesHeld: 'Suas cotas',
    csv: 'Baixar CSV',
    csvAll: 'Baixar CSV (todas as equipes)',
    shareLink: 'Copiar o link do relatório para a equipe',
    linkCopied: 'Link copiado — qualquer pessoa com ele pode ver este relatório.',
    months: 'Mês a mês',
    monthDetails: 'Detalhes do mês',
    served: 'Atendidos',
    cashEnd: 'Caixa no fim',
    loanEnd: 'Empréstimo no fim',
    savingsMark: '(economias)',
    decisions: 'Suas decisões',
    auto: '(repetida)',
    autoNote: '«Repetida» quer dizer que a equipe não enviou decisão e a anterior foi usada.',
    shifts: 'Turnos',
    qualityInvest: 'Qualidade',
    allDecisions: 'Decisões de todas as equipes',
    allDecisionsLead: 'Abertas depois do final para que as equipes revejam o jogo juntas.',
    decisionsCount: '{n} meses',
    decisionsCount_one: '{n} mês',
    hidden: 'As decisões das outras equipes abrem depois do final.',
    closedBook: 'O facilitador manteve privadas as decisões das outras equipes.',
    log: 'Movimentação de dinheiro',
    what: 'O quê', amount: 'Valor', note: 'Observação',
    notes: {
      start_capital: 'Capital inicial',
      month_cash_flow: 'Resultado do mês {n}',
      dividends: 'Dividendos das suas cotas',
      loan_out: 'Empréstimo recebido',
      loan_repay: 'Quitação antecipada do empréstimo',
      loan_repay_closing: 'Empréstimo quitado no fechamento',
      transfer_to: 'Transferência para {team}',
      transfer_from: 'Transferência de {team}',
      stake_bought_city: 'Compra de {pct} {inst} da cidade',
      stake_sold_city: 'Venda de {pct} {inst} para a cidade',
      stake_bought: 'Compra de {pct} {inst} de {team}',
      stake_sold: 'Venda de {pct} {inst} para {team}',
      unpaid_written_off: 'Contas não pagas baixadas',
      business_closed: 'Negócio fechado',
      cash_kept: 'Caixa mantido após o fechamento',
      left_game: 'Saída do jogo',
      new_business: 'Abertura de um negócio novo',
      new_business_cash: 'Caixa inicial do negócio novo',
      salary_to: 'Salário para {name}',
      salary_from: 'Salário de {team}',
      civil_salary: 'Salário do emprego público',
      civilSalaryMonths: 'Salário do emprego público por {n} meses'
    },
    kinds: {
      start_capital: 'Capital inicial', month_cash_flow: 'Resultado do mês', loan_out: 'Empréstimo recebido',
      loan_repay: 'Empréstimo quitado', transfer_in: 'Transferência recebida', transfer_out: 'Transferência enviada',
      civil_salary: 'Salário público', employer_salary: 'Salário', settlement: 'Fechamento do negócio',
      bankruptcy: 'Falência', reopen: 'Restaurante novo', fine: 'Multa da cidade', grant: 'Subsídio da cidade',
      city_tax: 'Taxa municipal', dividend: 'Dividendos', stake_buy: 'Compra de cota', stake_sell: 'Venda de cota'
    }
  },

  guide: {
    title: 'Guia',
    print: 'Imprimir',
    contents: 'Sumário',
    lead: 'Todos os números são as regras atuais deste jogo. Se o facilitador mudar uma regra, o guia se atualiza quando a mudança entrar em vigor.',
    costs: {
      item: 'Custo', amount: 'Valor', who: 'Pago a',
      perMeal: '{cogs} por refeição (+{qadd} por ponto de qualidade)', suppliers: 'Fornecedores', staff: 'Sua equipe',
      fixed: 'Custos fixos', perShift: '{cost} por turno extra', perPoint: '{upkeep} por ponto de qualidade',
      yourCall: 'Propaganda e investimento em qualidade', decide: 'o que você decidir'
    },
    channels: {
      seo: ['Começo lento: pague alguma coisa {seoRamp} meses seguidos e só então ele liga. Depois se mantém com pequenos reforços (perde {seoDecay} por mês). Orçamento típico: {seoRef}.'],
      promo: ['Só funciona no mês em que você paga. Nada se acumula — parou de pagar, acabou. Orçamento típico: {promoRef}.'],
      maps: ['Começa a funcionar no mês **seguinte** ao pagamento, depois se acumula e perde força devagar ({mapsDecay} por mês). Orçamento típico: {mapsRef}.'],
      social: ['Funciona na hora, mas é o que as pessoas esquecem mais rápido: {socialDecay} do efeito some a cada mês. Publique com regularidade — uma vez só quase não serve. Orçamento típico: {socialRef}.'],
      outdoor: ['Uma veiculação de pelo menos {outdoorMin} funciona exatamente {outdoorMonths} meses e depois para de uma vez. Pague de novo para renovar. Orçamento típico: {outdoorRef}.'],
      affiliate: ['Não traz clientes novos. Enquanto você pagar pelo menos {affiliateMin} por mês, os clientes que você atende gastam {affiliateBonus} a mais. Pagar acima do mínimo não acrescenta nada.']
    },
    s: {
      goal: {
        title: 'Como vencer',
        body: [
          'Você comanda um restaurante. As outras equipes comandam restaurantes na mesma cidade e disputam os mesmos clientes. Todo mês você define preço, propaganda, equipe e qualidade; o facilitador calcula o mês e todos veem o resultado no placar.',
          'Vence a equipe com mais **dinheiro** no fim — não a de maior receita nem a de maior participação de mercado. Seu resultado é o multiplicador de capital: dinheiro no fim ÷ seu capital inicial de {startCapital}.',
          '> A lição maior é de onde vem o dinheiro. Brigar pelos mesmos clientes deixa as águas vermelhas; comida melhor, preço justo e acordos inteligentes deixam as águas azuis. Veja «Oceano vermelho ou oceano azul».',
          'Este jogo: liga {league}, {total} meses, cerca de {minutes} minutos por mês.'
        ],
        practice: 'Este é um jogo de treino: não vale para o ranking.'
      },
      ocean: {
        title: 'Oceano vermelho ou oceano azul',
        body: [
          'Na maioria dos mercados todos brigam pelos mesmos clientes, e a água fica vermelha: os preços caem, os orçamentos de propaganda sobem e as empresas perdem dinheiro juntas. No Market Game dá para ver isso em uma noite — a visão Economia do placar mostra a cor da água todo mês.',
          '**O que deixa as águas vermelhas**',
          '- **Guerra de preços.** Cobrar menos de {pRef} tira clientes dos concorrentes, mas cada cliente passa a render menos. Quando todos baixam, ninguém ganha clientes — a cidade só perde margem.',
          '- **Corrida de propaganda.** A propaganda mais troca clientes de um restaurante para outro. Quando todos dobram o orçamento, as participações ficam iguais e todos pagam mais.',
          '- **Restaurantes demais.** {marketBase} clientes por mês sustentam com lucro, a um preço justo, cerca de {feedsText}. Com mais restaurantes do que isso, todos perdem dinheiro.',
          '**O que deixa as águas azuis**',
          '- **A qualidade faz o mercado inteiro crescer:** +{gain} clientes para cada ponto de qualidade média na cidade. É a alavanca que aumenta o bolo para todos.',
          '- **Preço justo por comida boa** deixa cada cliente lucrativo e fortalece sua marca.',
          '- **Saia das águas vermelhas a tempo:** feche antes que os prejuízos comam seu capital, venda seu talento a outra equipe ou compre cotas do locador, da seguradora, da concessionária ou do banco — eles ganham com o mercado inteiro.',
          '- **Façam águas azuis juntos:** converse com as outras equipes entre os meses. Invistam juntos em qualidade, façam promoções conjuntas, unam-se — uma equipe entra na outra em troca de salário ou de parte do lucro. Quando a cidade inteira ganha, cada equipe ganha.',
          '> No jogo vale negociar qualquer coisa. Nos negócios reais dos EUA, combinar preços com concorrentes é ilegal (leis antitruste). O caminho legal para as águas azuis é ser diferente, ser melhor e fazer o mercado crescer.',
          'A meta maior: depois de alguns jogos você enxerga quando e por que a água fica vermelha — e aprende a deixá-la azul.'
        ]
      },
      month: {
        title: 'Como é um mês',
        body: [
          '- O facilitador abre o mês. O cronômetro no topo mostra quanto tempo você tem.',
          '- Envie sua decisão. Você pode mudá-la até o tempo acabar.',
          '- O facilitador calcula o mês. Resultados, novidades e o placar se atualizam em todas as telas.',
          '- Perdeu o prazo? Sua última decisão se repete, ajustada ao caixa que você tem. Ficar parado também é uma jogada — quase sempre ruim.',
          'Entre os meses: converse com as outras equipes, pegue ou quite empréstimos, envie dinheiro e feche acordos.'
        ]
      },
      pnl: {
        title: 'Seu mês em duas linhas',
        body: [
          '= receita − alimentos e insumos − aluguel − seguro − contas − folha − turnos, qualidade, propaganda − juros do empréstimo − imposto sobre o lucro = lucro líquido',
          '= lucro líquido − amortização do empréstimo = variação do seu caixa',
          'Os custos fixos vencem de qualquer jeito: **{fixedTotal} por mês**. Ao preço de referência de {pRef}, cada refeição deixa {margin} depois do custo dos alimentos, então você precisa de cerca de **{breakEven} clientes por mês** só para empatar.'
        ]
      },
      market: {
        title: 'O mercado',
        body: [
          'A cidade começa com **{marketBase} clientes por mês**, divididos entre todos os restaurantes. O mercado não cresce com o número de equipes: mais restaurantes significam menos clientes para cada um.',
          '- Comida boa faz o mercado crescer: **+{gain}** clientes para cada ponto da qualidade **média** da cidade. Uma equipe investe — todos ganham.',
          '- Preços baixos tiram as pessoas de casa: com preço médio baixo o mercado cresce até ×{catMax}; com preço alto, encolhe até ×{catMin}.',
          '- Clientes além da sua capacidade são recusados — e isso prejudica sua reputação.'
        ]
      },
      choice: {
        title: 'Como os clientes escolhem',
        body: [
          'Cada restaurante recebe uma fatia do mercado proporcional ao quanto é atraente:',
          '= atratividade = (1 + ½ marca + ½ qualidade + propaganda) × fator de preço × reputação',
          '= seus clientes = mercado × sua atratividade ÷ atratividade de todos',
          'Você atende quantos couberem na sua capacidade.'
        ]
      },
      price: {
        title: 'Preço',
        body: [
          'Preço de referência: **{pRef}**. Você pode cobrar de {floor} a {ceiling}.',
          '- Os clientes prestam atenção no preço: 10% mais barato deixa você cerca de 26% mais atraente; 10% mais caro, cerca de 19% menos.',
          '- Acima de **{softCap}** é o ponto de dor: os clientes vão embora de uma vez, não aos poucos.',
          '- Cada refeição custa {cogs} em alimentos e insumos, mais com qualidade maior. Não cobre menos que isso.',
          '- Um preço que parece justo para a sua qualidade faz a marca crescer mais rápido.'
        ]
      },
      capacity: {
        title: 'Capacidade e turnos',
        body: [
          'Você pode atender **{capacityBase} clientes por mês**. Cada turno extra acrescenta {step} clientes de capacidade por {cost} por mês.',
          '- Mude um turno por mês, de {min} a +{max}.',
          '- Cortar abaixo da base reduz a capacidade, mas não a folha.',
          '- Mais clientes do que lugares? O resto vai embora, e sua reputação cai.'
        ]
      },
      quality: {
        title: 'Qualidade',
        body: [
          'Um investimento único: cada **{unit}** compra +1 ponto de qualidade, até 3.',
          '- A qualidade se desgasta {decay} por mês, e a manutenção custa {upkeep} por mês por ponto.',
          '- Comida melhor custa mais: +{qadd} no custo dos alimentos por ponto.',
          '- A qualidade deixa você mais atraente, ajuda a marca a crescer e faz o mercado inteiro crescer.'
        ]
      },
      marketing: {
        title: 'Propaganda',
        body: [
          'Seis canais, cada um com seu jeito. O retorno diminui: quatro vezes o orçamento dá o dobro do efeito, não o quádruplo. Espalhar o dinheiro entre canais costuma render mais do que pôr tudo em um só.'
        ]
      },
      brand: {
        title: 'Marca e reputação',
        body: [
          '- **Marca** (0–3): cresce com clientes satisfeitos — atenda mais do que a sua parte justa a um preço justo. Perde {brandDecay} por mês.',
          '- **Reputação** (0,6–1,0): multiplica sua atratividade. Recusar clientes a derruba; ela se recupera sozinha, devagar.',
          '- **Qualidade** (0–3): o que você comprou com investimento.'
        ]
      },
      costs: {
        title: 'Custos mensais',
        body: [
          'O aluguel vai para o locador, o seguro para a seguradora e as contas para a concessionária. Veja «Locador, banco, seguradora, concessionária» mais abaixo — você pode ter cotas delas.'
        ]
      },
      tax: {
        title: 'Imposto sobre o lucro',
        body: [
          '**{taxRate}** do seu lucro vai para o orçamento da cidade.',
          'Os prejuízos são compensados depois: após um prejuízo, você não paga imposto até que os lucros seguintes o cubram.'
        ],
        body0: [
          'No momento não há imposto sobre o lucro neste jogo. Os prejuízos continuam registrados, caso a cidade crie um imposto.'
        ]
      },
      bank: {
        title: 'Banco e empréstimos',
        body: [
          '- Um empréstimo inicial de até **{l1}** está liberado desde o primeiro mês — antes mesmo de o mês 1 ser calculado.',
          '- Dois meses seguidos de fluxo de caixa positivo sobem o limite para **{l3}** ({l2} depois de uma parcela atrasada). O limite nunca diminui.',
          '- Os juros são de {rate} ao ano ({monthly} ao mês) sobre o que você deve. A amortização é feita em {term} parcelas mensais iguais; um empréstimo novo reinicia o cronograma.',
          '- Dá para quitar antecipadamente a qualquer momento.',
          '> Empréstimo não é receita: seu capital é o caixa **menos** o que você deve. Pegue emprestado para crescer, não para parecer rico — um empréstimo no último mês só acrescenta juros.',
          'O banco deste jogo é fictício e não é uma oferta de crédito.'
        ]
      },
      cash: {
        title: 'Se o caixa acabar',
        body: [
          'Se o seu caixa ficar abaixo de zero no fim de um mês, o restaurante fecha. O que você ainda deve ao banco é baixado — o prejuízo é do banco. Depois, escolha o que fazer:',
          '- **Emprego público**: {civil} por mês do orçamento da cidade, pago automaticamente.',
          '- **Autônomo**: viver de transferências de outras equipes. Negocie.',
          '- **Ser contratado**: diga qual é o seu ofício e ofereça a uma equipe por um salário que ela paga todo mês.',
          'De volta ao jogo: junte **{reopen}** e abra um restaurante novo do zero — marca, reputação, qualidade e propaganda começam do zero, e suas economias viram o novo caixa. Você pode trocar de caminho quando quiser; as economias continuam com você.',
          'Você também pode fechar o negócio por conta própria: fica com o caixa depois de quitar o empréstimo.'
        ]
      },
      deals: {
        title: 'Acordos e transferências',
        body: [
          'Envie dinheiro para qualquer equipe, até o valor do seu caixa: pague por um serviço, ajude um aliado, compre parte do negócio dele. O facilitador vê todas as transferências.'
        ]
      },
      owners: {
        title: 'Locador, banco, seguradora, concessionária — e cotas',
        body: [
          'O aluguel, os juros, o seguro e as contas que os restaurantes pagam são receita de quatro empresas. Todo mês cada empresa distribui o lucro aos donos na proporção das cotas — depois de cobrir os próprios prejuízos anteriores. O banco perde os empréstimos que as equipes falidas nunca pagaram.',
          'A cidade tem parte de cada empresa (o facilitador decide quanto); donos privados têm o resto. A cidade pode vender parte das suas cotas a uma equipe: a partir daí, essa equipe recebe todo mês sua parte do lucro como dividendos. Recompras e acordos entre equipes também passam pelo facilitador.',
          '> Cotas não contam no capital final — só o dinheiro conta. Vale comprar uma cota se os dividendos a pagarem antes do fim do jogo.',
          'Quando uma equipe sai do jogo, as cotas dela voltam para a cidade.',
          'Uma jogada clássica: pegar um empréstimo, comprar cotas da seguradora e depois convencer a cidade a aumentar os prêmios de seguro.'
        ]
      },
      city: {
        title: 'A cidade e o facilitador',
        body: [
          'O facilitador joga como a cidade. A cidade arrecada o imposto sobre o lucro, multas, taxas municipais, sua parte do lucro das empresas e o dinheiro da venda de cotas. Ela paga subsídios, salários do emprego público e recompras de cotas. O orçamento dela está no placar.',
          'Fazer lobby funciona: convença o facilitador a mudar as regras — aluguel, seguro, contas, folha, impostos, taxa de juros. As mudanças valem a partir do mês seguinte e são anunciadas antes.'
        ]
      },
      board: {
        title: 'O placar',
        body: [
          '- Capital e renda aparecem para todos, inclusive para as equipes fora do negócio.',
          '- Participação de mercado, clientes e marca — só para as equipes com restaurante aberto.',
          '- Economia mostra o mercado, o orçamento da cidade e as quatro empresas; «Para onde foi o dinheiro» acompanha cada dólar que os clientes pagaram.'
        ]
      },
      scoring: {
        title: 'Vitória e ranking',
        body: [
          '- **Capital** é o seu dinheiro no fim menos o que você ainda deve ao banco: o caixa menos o saldo do empréstimo, ou as economias se você estiver fora do negócio.',
          '- **Multiplicador** = capital ÷ {startCapital}. A **colocação** é por capital.',
          '- O ranking da liga soma todos os jogos válidos: pontuação = 0,7 × multiplicador médio + 0,9 × nota média de colocação (1 para o primeiro lugar, 0 para o último).',
          '- Um jogo vale quando é jogado até o último mês e não é de treino. Uma equipe conta se jogou pelo menos três quartos dos meses ({minMonths} de {total}).'
        ]
      },
      leagues: {
        title: 'Ligas',
        body: [
          '- **Início** — 12 meses — para quem vai abrir um negócio.',
          '- **Crescimento** — 24 meses — para donos de um negócio em funcionamento.',
          '- **Elite** — 36 meses — para executivos e equipes de gestão.'
        ],
        current: 'Você está jogando na liga {league}.'
      }
    }
  },

  csv: {
    month: 'Mês', status: 'Situação', team: 'Equipe', inBusiness: 'No negócio', price: 'Preço',
    served: 'Clientes atendidos', lost: 'Clientes recusados', sharePct: 'Participação de mercado %', revenue: 'Receita',
    cogs: 'Alimentos e insumos', rent: 'Aluguel', insurance: 'Seguro', utilities: 'Contas e outros', payroll: 'Folha de pagamento',
    shifts: 'Turnos extras', qualityUpkeep: 'Manutenção da qualidade', qualityInvest: 'Investimento em qualidade',
    advertising: 'Propaganda', ebit: 'Lucro operacional', interest: 'Juros do empréstimo', pbt: 'Lucro antes do imposto',
    tax: 'Imposto sobre o lucro', profit: 'Lucro líquido', principal: 'Amortização do empréstimo', cashFlow: 'Fluxo de caixa',
    dividends: 'Dividendos', cashEnd: 'Caixa / economias no fim do mês', loanEnd: 'Saldo do empréstimo no fim do mês',
    capital: 'Capital (caixa − empréstimo)', brand: 'Marca', reputation: 'Reputação', quality: 'Qualidade',
    capacity: 'Capacidade', sent: 'Decisão enviada pela equipe', cash: 'Caixa / economias', profitIncome: 'Lucro / renda',
    repeated: 'Repetida automaticamente', shiftChange: 'Mudança de turnos',
    yes: 'sim', no: 'não', noRepeated: 'não (repetida)'
  },

  tz: {
    eastern: 'Leste dos EUA (Nova York)', central: 'Centro dos EUA (Chicago)', mountain: 'Montanhas (Denver)',
    arizona: 'Arizona (Phoenix)', pacific: 'Pacífico (Los Angeles)', alaska: 'Alasca (Anchorage)',
    hawaii: 'Havaí (Honolulu)', atlantic: 'Atlântico (Porto Rico)', toronto: 'Toronto', mexicoCity: 'Cidade do México',
    saoPaulo: 'São Paulo', london: 'Londres', berlin: 'Berlim', dubai: 'Dubai', bangkok: 'Bangkok', tokyo: 'Tóquio',
    sydney: 'Sydney', utc: 'UTC'
  },

  charts: {
    legend: 'Legenda', highlight: 'Destacar {name}', other: 'Outros', nothing: 'Nada neste mês'
  },

  statuses: {
    active: 'Aberto', bankrupt: 'Falido', civil_service: 'Emprego público', freelance: 'Autônomo',
    custom_employed: 'Contratado', left: 'Saiu', setup: 'Não iniciado', running: 'Em andamento', finished: 'Encerrado'
  },

  errors: {
    auth_required: 'Entre novamente, por favor.',
    not_registered: 'Este e-mail ainda não está em nenhum jogo. Peça ao facilitador para cadastrá-lo.',
    bad_email: 'Isso não parece um endereço de e-mail.',
    not_in_game: 'Você não está no elenco deste jogo.',
    not_host: 'Só o facilitador pode fazer isso.',
    not_admin: 'Só um administrador pode fazer isso.',
    game_not_found: 'Jogo não encontrado.',
    player_not_found: 'Equipe não encontrada.',
    round_closed: 'O mês não está aberto — aguarde o facilitador.',
    price_too_low: 'O preço precisa ficar entre {min} e {max}.',
    price_too_high: 'O preço precisa ficar entre {min} e {max}.',
    bad_price: 'Informe um preço.',
    insufficient_cash: 'Dinheiro insuficiente: você tem {available}.',
    negative_spend: 'Os valores não podem ser negativos.',
    shifts_step: 'Dá para adicionar ou cortar um turno por mês.',
    shifts_out_of_range: 'Esse número de turnos não é permitido.',
    no_credit_yet: 'O crédito ainda não está disponível.',
    over_limit: 'Isso passa do seu limite de crédito. Disponível: {available}.',
    no_loan: 'Você não tem empréstimo para quitar.',
    bad_amount: 'Confira o valor.',
    bad_params: 'Confira os campos.',
    self_transfer: 'Você não pode enviar dinheiro para si mesmo.',
    recipient_not_found: 'Essa equipe não está mais no jogo.',
    not_active: 'Só um restaurante aberto pode fazer isso.',
    invalid_path: 'Escolha um caminho.',
    invalid_state: 'Isso não é possível agora.',
    empty_profession: 'Informe o seu ofício.',
    not_eligible: 'Só equipes fora do negócio podem abrir um restaurante novo.',
    not_enough_savings: 'Você precisa de {needed} em economias para abrir um restaurante novo.',
    not_custom_path: 'Escolha «Ser contratado» primeiro.',
    self_employer: 'Você não pode contratar a si mesmo.',
    employer_not_found: 'Essa equipe não está no jogo.',
    employer_not_active: 'O restaurante dessa equipe está fechado.',
    not_your_employee: 'Essa pessoa não trabalha para você.',
    already_paid: 'Já foi pago neste mês.',
    game_finished: 'Este jogo terminou.',
    already_open: 'O mês já está aberto.',
    no_open_round: 'Não há mês aberto para calcular.',
    no_players: 'Primeiro cadastre pelo menos uma equipe.',
    city_has_less: 'A cidade tem só {cityPct}% — não pode vender mais.',
    not_enough_stake: 'Essa equipe tem só {has}%.',
    over_100: 'A soma das cotas não pode passar de 100%. A cidade pode ter no máximo {maxCityPct}%.',
    bad_pct: 'Informe uma participação entre 0 e 100%.',
    bad_institution: 'Escolha uma empresa.',
    player_cannot_trade: 'Essa equipe não pode negociar cotas agora.',
    player_left: 'Essa equipe saiu do jogo.',
    round_open: 'Calcule primeiro o mês aberto.',
    game_has_history: 'Jogos com meses jogados não podem ser excluídos.',
    game_started: 'Isso não pode mudar depois que o jogo começou.',
    empty_title: 'Dê um nome ao jogo.',
    bad_league: 'Escolha uma liga.',
    bad_url: 'Os links precisam começar com https://',
    bad_logo: 'Esse logotipo não pode ser usado. Envie um arquivo PNG ou JPG.',
    bad_timezone: 'Escolha um fuso horário.',
    bad_language: 'Escolha um idioma.',
    bad_date: 'Confira a data.',
    too_many_teams: 'Até {max} equipes por jogo.',
    restaurant_taken: 'Outra equipe já usa esse nome de restaurante.',
    bad_state: 'Escolha um estado.',
    bad_country: 'Informe o seu país.',
    bad_location: 'Conte onde vocês fazem negócios.',
    empty: 'Preencha todos os campos.',
    bad_code: 'Digite o código do jogo.',
    bad_game: 'Jogo não encontrado.',
    report_not_found: 'Este link de relatório não funciona.',
    duplicate_request: 'Já foi feito.',
    unknown_action: 'Algo está desatualizado — recarregue a página.',
    rate_limited: 'Tentativas demais. Espere um minuto e tente de novo.',
    bad_code_otp: 'Esse código não funcionou. Confira ou peça um novo.',
    network: 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
    server_error: 'Algo deu errado do nosso lado. Tente de novo daqui a pouco.'
  }
};
