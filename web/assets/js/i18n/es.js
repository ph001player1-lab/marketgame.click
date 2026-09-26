// Diccionario en español — neutro, como se habla en los negocios de EE. UU. y
// de América Latina: «utilidad», «renta», «nómina», «facilitador».
// Montos en dólares, con el formato de EE. UU.: $12,340.

export default {
  brand: 'Market Game',
  tagline: 'Hacia aguas nuevas, no a la pelea',

  common: {
    loading: 'Cargando…',
    retry: 'Intentar de nuevo',
    cancel: 'Cancelar',
    close: 'Cerrar',
    save: 'Guardar',
    send: 'Enviar',
    done: 'Listo',
    back: 'Atrás',
    yes: 'Sí',
    no: 'No',
    ok: 'OK',
    month: 'Mes',
    monthOf: 'Mes {n} de {total}',
    notStarted: 'Sin empezar',
    finished: 'Terminado',
    practice: 'Práctica',
    rated: 'Cuenta para el ranking',
    notRated: 'No cuenta para el ranking',
    copy: 'Copiar',
    copied: 'Copiado',
    signOut: 'Cerrar sesión',
    myGames: 'Mis juegos',
    menu: 'Menú',
    you: 'Tú',
    team: 'Equipo',
    teams: 'Equipos',
    total: 'Total',
    none: 'Ninguno',
    from: 'de',
    perMonth: '/mes',
    city: 'Ciudad',
    private: 'Dueños privados',
    sponsoredBy: 'Patrocinado por',
    sponsorNote: 'El patrocinador no participa en el juego. Los préstamos, tasas y condiciones del juego son ficticios y no son una oferta de crédito.',
    serverTime: 'Hora del servidor',
    newTeam: 'Equipo nuevo',
    someone: 'Un jugador'
  },

  settings: {
    title: 'Configuración',
    language: 'Idioma',
    auto: 'Automático ({lang})',
    autoHint: 'Automático: en un juego, el idioma que eligió el facilitador; en el resto del sitio, el idioma de tu navegador. Tu elección se guarda en este navegador.'
  },

  leagues: {
    start: 'Inicio', growth: 'Crecimiento', elite: 'Élite',
    startWho: 'Para quienes están por abrir un negocio',
    growthWho: 'Para dueños de un negocio en marcha',
    eliteWho: 'Para directivos y equipos de gerencia'
  },

  tabs: {
    business: 'Negocio', console: 'Consola', board: 'Marcador', guide: 'Guía'
  },

  login: {
    title: 'Iniciar sesión',
    lead: 'Usa el correo que el facilitador agregó al juego. Te enviaremos un código de 6 dígitos; no necesitas contraseña.',
    email: 'Correo electrónico',
    sendCode: 'Enviarme un código',
    codeSent: 'Enviamos un código de 6 dígitos a {email}. Vale por una hora.',
    code: 'Código del correo',
    verify: 'Entrar',
    otherEmail: 'Usar otro correo',
    resend: 'Enviar un código nuevo',
    noEmail: '¿No llegó el correo? Revisa la carpeta de spam o pide al facilitador que confirme la dirección.',
    testMode: 'Modo de prueba: sirve cualquier código de 6 dígitos.'
  },

  home: {
    title: 'Mis juegos',
    playing: 'Juegos en los que participo',
    hosting: 'Juegos que facilito',
    noGames: 'Todavía no estás en ningún juego. El facilitador agregará tu correo a un juego.',
    noHosted: 'Aún no hay juegos. Crea el primero.',
    newGame: 'Crear un juego',
    open: 'Abrir',
    report: 'Informe',
    place: 'Lugar {place} de {rivals}',
    capital: 'Capital',
    multiplier: 'Multiplicador',
    share: 'Cuota de mercado',
    hostsLink: 'Facilitadores',
    ratingLink: 'Ranking'
  },

  profile: {
    title: 'Bienvenido al juego',
    lead: 'Cuéntales a los otros equipos quiénes son. Verán su nombre y su restaurante, nunca su correo.',
    name: 'Tu nombre',
    restaurant: 'Nombre del restaurante',
    where: '¿Dónde hacen negocios?',
    inState: 'En un estado',
    multistate: 'En todo EE. UU. (varios estados)',
    international: 'Fuera de EE. UU.',
    state: 'Estado',
    country: 'País',
    start: 'Empezar a jugar',
    edit: 'Editar perfil'
  },

  header: {
    cash: 'Caja',
    savings: 'Ahorros',
    timerOpen: 'Las decisiones cierran en',
    waiting: 'Esperando al facilitador',
    impersonating: 'Vista del facilitador: juegas como {team}',
    backToConsole: 'Volver a la consola'
  },

  notices: {
    title: 'Novedades para ti',
    gotIt: 'Entendido',
    reason: 'Motivo: {reason}',
    anEmployee: 'empleado',
    kinds: {
      fine: 'La ciudad te multó con {amount}.',
      grant: 'La ciudad te dio un subsidio de {amount}.',
      city_tax: 'La ciudad cobró un impuesto de {amount}.',
      stake_bought_city: 'Compraste a la ciudad el {pct} {inst} por {amount}. Tu parte de sus utilidades te llega cada mes.',
      stake_buyback: 'La ciudad te recompró el {pct} {inst} por {amount}.',
      stake_bought: 'Compraste el {pct} {inst} a {team} por {amount}.',
      stake_sold: 'Vendiste el {pct} {inst} a {team} por {amount}.',
      transfer: '{team} te envió {amount}.',
      employment: '{name} te ofrece trabajar para ti como {job} por {salary} al mes.',
      credit: 'Tu límite de crédito ahora es {amount}.',
      bankrupt: 'Tu restaurante se quedó sin efectivo y cerró. Elige qué hacer ahora.'
    }
  },

  upcoming: {
    title: 'A partir del próximo mes',
    keys: {
      ROUND_DURATION_MIN: 'Duración del mes, min', RENT: 'Renta', INSURANCE: 'Seguro',
      UTILITIES: 'Servicios y otros', PAYROLL_BASE: 'Nómina', START_CAPITAL: 'Capital inicial',
      CIVIL_SERVICE_SALARY: 'Sueldo en empleo público', REOPEN_THRESHOLD: 'Ahorro para reabrir',
      P_REF: 'Precio de referencia', MARKET_SIZE_PER_PLAYER: 'Mercado base, clientes',
      MARKET_QUALITY_GAIN: 'Crecimiento del mercado por punto de calidad', LOAN_RATE_ANNUAL: 'Tasa del préstamo',
      LOAN_TERM_MONTHS: 'Plazo del préstamo, meses', PROFIT_TAX_RATE: 'Impuesto sobre utilidades'
    }
  },

  stats: {
    brand: 'Marca', reputation: 'Reputación', quality: 'Calidad', capacity: 'Capacidad',
    guestsMo: 'clientes/mes', lossCf: 'Pérdidas por cubrir antes de impuestos'
  },

  decision: {
    title: 'Tus decisiones para el mes {n}',
    closed: 'Las decisiones están cerradas. Habla de estrategia con otros equipos: el formulario se abre cuando el facilitador inicia el mes.',
    notStarted: 'El juego aún no empieza. El formulario se abre cuando el facilitador inicie el mes 1.',
    over: 'El juego terminó. Consulta los resultados finales en el marcador.',
    sent: 'Decisión enviada. Puedes cambiarla hasta que termine el tiempo.',
    sentAt: 'Último envío: {time}',
    price: 'Precio por comida',
    priceHint: 'Permitido de {min} a {max}. Arriba de {soft} los clientes se van de golpe.',
    marketing: 'Marketing: reparte tu presupuesto por canal',
    shifts: 'Turnos de personal',
    shiftsMinus: 'Quitar un turno',
    shiftsSame: 'Sin cambio',
    shiftsPlus: 'Agregar un turno',
    shiftsHint: 'Un turno = {cap} clientes más de capacidad por {cost}/mes. Ahora: turnos adicionales {shifts}, capacidad {capacity}.',
    quality: 'Invertir en calidad (una vez)',
    qualityHint: '{unit} compra +1 punto de calidad (máximo 3). Mantenimiento: {upkeep}/mes por punto. Mejor comida también hace crecer todo el mercado: la jugada del océano azul.',
    priceWarTip: 'Por debajo del precio de referencia cada cliente te deja menos. Si todos los restaurantes bajan, nadie gana clientes y toda la ciudad pierde dinero. Consulta «Océano rojo u océano azul» en la Guía.',
    totalSpend: 'Gasto de este mes: {total} de {cash} en caja',
    overCash: 'Es más de lo que tienes en caja.',
    submit: 'Enviar decisión',
    resubmit: 'Actualizar decisión',
    perMonthPlaceholder: '$ este mes',
    needed: 'Falta tu decisión'
  },

  channels: {
    seo: { name: 'SEO', blurb: 'Necesita 3 meses seguidos para arrancar. Después se sostiene con poco mantenimiento.' },
    promo: { name: 'Promoción en la calle', blurb: 'Volantes y promotores. Solo funciona el mes que pagas: si dejas de pagar, desaparece.' },
    maps: { name: 'Google Maps', blurb: 'Empieza a funcionar el mes siguiente al pago y luego se desvanece despacio.' },
    social: { name: 'Redes sociales', blurb: 'Funciona de inmediato, pero la gente olvida rápido. Hay que ser constante.' },
    outdoor: { name: 'Espectaculares', blurb: 'Una colocación (desde {min}) dura exactamente {months} meses y luego cae a cero.' },
    affiliate: { name: 'Programa de lealtad', blurb: 'No trae clientes nuevos. Suma {bonus} a los ingresos de los clientes que atiendes mientras pagues al menos {min} al mes.' },
    badges: {
      seoRamp: '{n} de {total} meses', seoOn: 'funcionando', mapsOn: 'funcionando', socialOn: 'activo',
      outdoorUntil: 'hasta el mes {n}', affiliateOn: 'activo', off: 'apagado'
    }
  },

  pl: {
    title: 'Resultados del mes {n}',
    served: 'atendidos', lost: 'rechazados',
    revenue: 'Ingresos', cogs: 'Costo de alimentos e insumos', gross: 'Utilidad bruta',
    rent: 'Renta', insurance: 'Seguro', utilities: 'Servicios y otros', payroll: 'Nómina',
    shifts: 'Turnos adicionales', qualityUpkeep: 'Mantenimiento de calidad', qualityInvest: 'Inversión en calidad',
    marketing: 'Marketing', ebit: 'Utilidad operativa', interest: 'Intereses del préstamo',
    pbt: 'Utilidad antes de impuestos', tax: 'Impuesto sobre utilidades', profit: 'Utilidad neta',
    principal: 'Abono a capital del préstamo', cashFlow: 'Flujo de caja', dividends: 'Dividendos de tus participaciones',
    cashAfter: 'Caja al cierre del mes', share: 'Cuota de mercado', byChannel: 'Marketing por canal',
    none: 'Aún no hay resultados: aparecen después del primer mes.'
  },

  bank: {
    title: 'Banco',
    balance: 'Saldo del préstamo', rate: 'Tasa', nextPayment: 'Próximo pago (capital + intereses)',
    termLeft: 'Pagos restantes', available: 'Disponible para pedir', limit: 'Límite de crédito',
    noCredit: 'El crédito no está disponible en este momento.',
    borrow: 'Pedir prestado', repay: 'Pagar por adelantado', amount: 'Monto, $',
    note: 'El banco del juego es ficticio. Tu capital es la caja menos el préstamo: pedir prestado no te hace más rico.',
    capital: 'Tu capital (caja − préstamo)',
    received: 'Préstamo recibido: {amount}.',
    repaid: 'Pagaste {amount}.'
  },

  transfer: {
    title: 'Enviar dinero a otro equipo',
    lead: 'Sale de tu caja. Útil para acuerdos, para ayudar a un aliado o para comprar parte de su negocio.',
    to: 'Destinatario', amount: 'Monto, $', send: 'Enviar', nobody: 'Todavía no hay otros equipos.',
    sent: 'Enviaste {amount} a {team}.'
  },

  stakes: {
    title: 'Tus participaciones',
    lead: 'Eres dueño de una parte de estas empresas y recibes tu parte de sus utilidades cada mes.',
    none: 'No tienes participaciones. La ciudad puede venderte parte del arrendador, del banco, de la aseguradora o de la empresa de servicios: pregúntale al facilitador.',
    lastMonth: 'el mes pasado: {amount}'
  },

  institutions: {
    landlord: 'Arrendador', bank: 'Banco', insurer: 'Aseguradora', utility: 'Empresa de servicios',
    landlordWhat: 'es dueño de los locales, cobra la renta',
    bankWhat: 'presta dinero, cobra intereses, pierde los préstamos impagos',
    insurerWhat: 'cobra las primas de seguro',
    utilityWhat: 'luz, agua, basura, comisiones de tarjeta y otros servicios'
  },

  // La empresa dentro de la frase: «el 10 % del arrendador».
  institutionsOf: {
    landlord: 'del arrendador', bank: 'del banco', insurer: 'de la aseguradora', utility: 'de la empresa de servicios'
  },

  employees: {
    title: 'Tus empleados',
    wants: '{name} quiere trabajar para ti como {job} por {salary}/mes',
    approve: 'Contratar', reject: 'Rechazar', pay: 'Pagar {salary}', paid: 'Pagado este mes',
    approved: 'Trabaja para ti'
  },

  career: {
    title: 'Cerrar el negocio y dedicarte a otra cosa',
    lead: 'Conservas tu caja después de liquidar el préstamo. Si el préstamo es mayor que tu caja, te vas sin deuda: esa pérdida es del banco. El restaurante cierra para siempre; más adelante puedes abrir otro.',
    civil: 'Empleo público', civilWhat: '{salary}/mes del presupuesto de la ciudad, en automático.',
    freelance: 'Trabajo independiente', freelanceWhat: 'Vives de transferencias de otros equipos. Negocia.',
    custom: 'Emplearte', customWhat: 'Di cuál es tu oficio y ofrécelo a un equipo a cambio de un sueldo.',
    end: 'Salir del juego', endWhat: 'Dejas de jugar. Tus participaciones regresan a la ciudad.',
    profession: 'Tu oficio, p. ej. Chef', confirm: 'Confirmar',
    confirmClose: '¿Cerrar tu restaurante y pasar a «{path}»? No se puede deshacer.',
    confirmEnd: '¿Salir del juego definitivamente?'
  },

  life: {
    bankruptTitle: 'Tu restaurante se quedó sin efectivo',
    bankruptLead: 'El negocio cerró. Elige qué hacer ahora: puedes volver con un restaurante nuevo cuando ahorres {threshold}.',
    civilTitle: 'Tienes un empleo público',
    freelanceTitle: 'Trabajas por tu cuenta',
    customTitle: 'Trabajas como {job}',
    savings: 'Ahorros', threshold: 'Necesario para reabrir', toReopen: 'Para abrir un restaurante nuevo necesitas: {threshold}',
    reopen: 'Abrir un restaurante nuevo', reopenWhat: 'Desde cero: marca, reputación, calidad y publicidad empiezan en cero. Tus ahorros se vuelven la caja del nuevo negocio.',
    salary: 'Sueldo de {salary}/mes, se paga al calcular cada mes.',
    offer: 'Ofrece tu trabajo a un equipo', employer: 'Equipo', salaryAsk: 'Sueldo mensual, $',
    offerSend: 'Enviar oferta', offerPending: 'Esperando la respuesta de {team}.',
    offerApproved: 'Trabajas para {team} por {salary}/mes.', paidThisMonth: 'Pagado este mes.',
    switchPath: 'Cambiar de camino',
    leftTitle: 'Saliste de este juego',
    leftLead: '¡Gracias por jugar! Todavía puedes ver el marcador.'
  },

  board: {
    title: 'Marcador',
    views: { teams: 'Equipos', economy: 'Economía', money: 'A dónde fue el dinero', rating: 'Ranking' },
    metrics: {
      capital: 'Capital', cash: 'Caja', profit: 'Utilidad', marketSharePct: 'Cuota de mercado', served: 'Clientes atendidos',
      price: 'Precio', brand: 'Marca', reputation: 'Reputación', quality: 'Calidad',
      capacity: 'Capacidad', marketingTotal: 'Publicidad', qualityInvest: 'Inversión en calidad',
      tax: 'Impuesto sobre utilidades', dividends: 'Dividendos'
    },
    metricNotes: {
      capital: 'La caja menos lo que el equipo aún le debe al banco; los ahorros, para equipos fuera del negocio. Gana el mayor capital al final.',
      cash: 'Efectivo del restaurante al cierre del mes, sin restar préstamos. Para equipos fuera del negocio, sus ahorros.',
      profit: 'Utilidad neta después de intereses e impuestos. Para equipos fuera del negocio, sus ingresos.',
      marketSharePct: 'Parte de todos los clientes de la ciudad que atendió el restaurante.',
      served: 'Clientes atendidos; los que no cupieron fueron rechazados.',
      price: 'Precio por comida.',
      brand: 'De 0 a 3. Crece con clientes contentos y se desgasta cada mes.',
      reputation: 'De 0.6 a 1.0. Baja cuando se rechaza a clientes.',
      quality: 'De 0 a 3. Se compra con inversión y se desgasta despacio.',
      dividends: 'Parte de las utilidades del arrendador, el banco, la aseguradora y la empresa de servicios.'
    },
    metric: 'Mostrar',
    you: '(tú)',
    legend: 'Equipos: haz clic en uno para resaltarlo',
    otherTeams: 'Otros equipos',
    offBusiness: 'fuera del negocio',
    mo: 'Mes',
    chartLabel: '{metric} por mes de {n} equipos. El botón Tabla muestra los números exactos.',
    showTable: 'Tabla',
    showChart: 'Gráfica',
    afterMonth: 'Después del mes {n}',
    beforeStart: 'Antes del mes 1',
    market: 'mercado de {guests} clientes',
    teamsCount: '{n} equipos',
    teamsCount_one: '{n} equipo',
    empty: 'Aún no hay resultados: el marcador se llena después del primer mes.',
    standings: 'Posiciones',
    capital: 'Capital',
    lastMonth: 'Último mes',
    share: 'Cuota',
    guests: 'Clientes',
    marketTitle: 'Tamaño del mercado, clientes al mes',
    marketWhy: 'Empieza en {base} clientes al mes. Crece {gain} por cada punto de calidad promedio en la ciudad. Precios promedio bajos atraen más clientes; precios altos, menos.',
    cityTitle: 'Presupuesto de la ciudad',
    cityBalance: 'Saldo {amount}',
    cityWhat: 'Ingresos arriba de cero, gastos abajo. La ciudad cobra el impuesto sobre utilidades, multas, impuestos municipales, su parte de las utilidades de las empresas y el dinero de la venta de participaciones. Paga subsidios, sueldos del empleo público y recompras de participaciones.',
    citySeries: {
      profitTax: 'Impuesto sobre utilidades', companies: 'Parte de las utilidades de las empresas',
      otherIncome: 'Multas, impuestos municipales, venta de participaciones', spending: 'Subsidios, sueldos, recompras'
    },
    cityIncome: {
      profitTax: 'Impuesto sobre utilidades', fines: 'Multas', cityTaxes: 'Impuestos municipales',
      dividends: 'Parte de las utilidades de las empresas', stakeSales: 'Venta de participaciones'
    },
    citySpending: { grants: 'Subsidios', civilSalaries: 'Sueldos del empleo público', stakeBuybacks: 'Recompra de participaciones' },
    net: 'Neto',
    balance: 'Saldo',
    balanceTitle: 'Saldo de la ciudad',
    ownership: 'Dueños',
    teamOwners: 'Equipos',
    holders: 'Participaciones de equipos',
    noHolders: 'Ningún equipo tiene participación todavía.',
    instTotals: 'Ingresos {income} · pagado a los dueños {payout}',
    writeOffsTotal: 'préstamos impagos cancelados {amount}',
    loansNow: 'préstamos vigentes {amount}',
    lossCf: 'pérdidas por cubrir antes de pagar a los dueños {amount}',
    income: 'Ingresos', profitInst: 'Utilidad', writeOffs: 'Cancelado', payout: 'Pagado a los dueños',
    loans: 'Préstamos vigentes',
    noPayout: 'Este mes no se pagaron utilidades',
    payoutChart: '{name}: utilidades pagadas a sus dueños por mes',
    payoutChartShort: 'Utilidades pagadas a los dueños',
    ratingTitle: 'Ranking de la liga {league}',
    ratingFull: 'Ranking completo',
    joinAt: 'Los equipos entran en',
    code: 'Código del juego',
    open: 'Abrir marcador',
    fullscreen: 'Pantalla completa',
    rotate: 'Cambiar de vista cada 20 segundos',
    decisionsOpen: 'decisiones abiertas',
    signInLead: 'El marcador es solo para los equipos de este juego, su facilitador y los administradores. Inicia sesión con tu correo para mostrarlo.'
  },

  ocean: {
    title: '¿Océano rojo u océano azul?',
    lead: 'Aguas rojas: los restaurantes de la ciudad pierden dinero juntos, casi siempre por una guerra de precios, una carrera publicitaria o demasiados restaurantes para los clientes que hay. Aguas azules: ganan juntos. Gana igual el equipo con más capital, pero en aguas azules hay más capital para ganar.',
    water: { red: 'Aguas rojas', choppy: 'Aguas agitadas', blue: 'Aguas azules' },
    earned: 'La ciudad ganó', lost: 'La ciudad perdió',
    summary: {
      earned: 'Mes {n}: los restaurantes juntos ganaron {amount} con ventas de {revenue} ({pct}).',
      lost: 'Mes {n}: los restaurantes juntos perdieron {amount} con ventas de {revenue} ({pct}).'
    },
    driversTitle: 'Qué movió el agua',
    driver: {
      priceWar: 'Guerra de precios en el mes {n}: el precio promedio fue {avg}, por debajo de la referencia de {ref}; cada cliente dejó menos para todos.',
      priceOk: 'Sin guerra de precios en el mes {n}: el precio promedio fue {avg} (referencia {ref}).',
      adRace: 'Carrera publicitaria en el mes {n}: la publicidad se llevó el {share} de todas las ventas; los anuncios sobre todo mueven clientes de un restaurante a otro.',
      adOk: 'Sin carrera publicitaria en el mes {n}: la publicidad se llevó el {share} de las ventas.',
      crowded: 'Demasiados restaurantes en el mes {n}: hubo {guests} clientes para {restaurants}; a un precio justo eso alcanza solo para alrededor de {feeds} con utilidades.',
      roomy: 'Hay espacio en el mes {n}: hubo {guests} clientes para {restaurants}; a un precio justo eso alcanza para alrededor de {feeds} con utilidades.',
      feedsHow: 'Cómo se calcula: a {ref}, cada cliente deja {perGuest} después del costo de la comida, así que un restaurante necesita unos {breakEven} clientes al mes para cubrir {fixed} de costos fijos. {guests} ÷ {breakEven} ≈ {feeds}.',
      quality: 'La calidad hizo crecer el mercado en el mes {n}: la calidad promedio de la ciudad fue {quality} de 3, así que llegaron {boost} más clientes que sin ninguna calidad: unos {extra} clientes extra, repartidos entre todos los restaurantes.',
      noQuality: 'Todavía no hay calidad en el mes {n}: la calidad promedio de la ciudad es 0. Cada punto de calidad promedio trae alrededor de {gain} más clientes, para todos los restaurantes y no solo para el que invirtió.'
    },
    nRestaurants: '{n} restaurantes',
    nRestaurants_one: '{n} restaurante',
    feedsNote: '«Pueden ganar dinero»: cuántos restaurantes podrían tener utilidades con los clientes de ese mes al precio de referencia: clientes ÷ los clientes que necesita un restaurante para cubrir sus costos fijos.',
    chartTitle: 'Resultado operativo de todos los restaurantes por mes',
    guideHint: 'Cómo volver azules las aguas: consulta «Océano rojo u océano azul» en la Guía.',
    columns: {
      restaurants: 'Restaurantes', guests: 'Clientes', feeds: 'Pueden ganar dinero', avgPrice: 'Precio promedio', adShare: 'Publicidad / ventas',
      quality: 'Calidad promedio', result: 'Resultado operativo', margin: 'Margen', water: 'Aguas'
    },
    debriefTitle: 'Análisis después del mes {n}',
    questionsTitle: 'Preguntas para los equipos',
    questions: {
      red: [
        '¿Qué volvió rojas las aguas este mes: los precios, la publicidad o demasiados restaurantes?',
        '¿Quién ganó con los descuentos y quién los pagó?',
        '¿Qué podrían hacer los equipos juntos para que toda la ciudad gane el próximo mes?'
      ],
      choppy: [
        'La ciudad apenas sale tablas. ¿Qué la inclinaría al rojo y qué al azul?',
        '¿Alguien está empezando una guerra de precios o una carrera publicitaria?',
        '¿Qué podrían hacer los equipos juntos para que toda la ciudad gane más?'
      ],
      blue: [
        '¿Qué mantuvo azules las aguas este mes?',
        '¿Qué podría volverlas rojas el próximo mes y cómo lo evitamos?',
        '¿En qué otra parte podemos hacer crecer el mercado en lugar de pelearlo?'
      ]
    },
    empty: 'El color del agua aparece después del primer mes.'
  },

  money: {
    title: 'A dónde fue el dinero',
    lead: 'Todo el dinero que pagaron los clientes en este juego y dónde terminó. Pasa el cursor o toca un flujo para ver el detalle.',
    guests: 'Clientes', restaurants: 'Restaurantes', losses: 'Capital y préstamos',
    suppliers: 'Alimentos e insumos', staff: 'Personal', advertising: 'Publicidad', quality: 'Calidad',
    landlord: 'Arrendador', insurer: 'Aseguradora', utility: 'Empresa de servicios', bank: 'Banco (intereses)',
    cityTax: 'Ciudad (impuesto sobre utilidades)', kept: 'Se quedó en los restaurantes',
    ofGuests: 'del dinero de los clientes',
    groupCost: 'Costos de los restaurantes', groupInstitutions: 'Arrendador, aseguradora, servicios, banco',
    groupCity: 'Ciudad', groupKept: 'Utilidades de los restaurantes', groupLosses: 'Pérdidas cubiertas con capital y préstamos',
    flow: 'Flujo', amount: 'Monto', share: 'Parte',
    ownersTitle: 'Quién se quedó con las utilidades de las empresas',
    ownersLead: 'El arrendador, el banco, la aseguradora y la empresa de servicios recibieron {amount} de los restaurantes. Sus utilidades van a sus dueños.',
    city: 'Ciudad', players: 'Equipos dueños', private: 'Dueños privados',
    retained: 'Cubrieron pérdidas y préstamos impagos',
    cityGot: 'La ciudad cobró impuesto sobre utilidades {tax}, multas e impuestos municipales {fines}, venta de participaciones {stakes}.',
    cityPaid: 'La ciudad pagó subsidios {grants}, sueldos del empleo público {salaries}, recompras de participaciones {buybacks}.',
    betweenTeams: 'Los equipos se enviaron entre sí {amount}.',
    empty: 'El mapa del dinero aparece después del primer mes.'
  },

  rating: {
    title: 'Ranking',
    lead: 'Todos los juegos de la liga que cuentan para el ranking. Puntaje = 0.7 × multiplicador de capital promedio + 0.9 × puntaje promedio por lugar.',
    howTitle: 'Cómo funciona el ranking',
    how1: 'Multiplicador de capital = capital al final del juego ÷ capital inicial. El capital es el dinero menos lo que el equipo aún debe al banco.',
    how2: 'El puntaje por lugar es 1 para el primer lugar, 0 para el último y un valor intermedio para los demás.',
    how3: 'Un juego cuenta si se juega hasta el último mes de su liga y no es de práctica.',
    how4: 'Un equipo cuenta en un juego si jugó al menos tres cuartas partes de los meses: 9 de 12, 18 de 24, 27 de 36.',
    leagueLabel: 'Liga',
    months: '{n} meses',
    filter: 'Dónde',
    all: 'En todas partes',
    multistate: 'En todo EE. UU.',
    usShort: 'EE. UU.',
    international: 'Fuera de EE. UU.',
    gamesList: '{n} juegos',
    gamesList_one: '{n} juego',
    gameLine: 'lugar {place} de {rivals}, {capital}, ×{mult}',
    columns: { team: 'Equipo', where: 'Dónde', games: 'Juegos', wins: 'Victorias', mult: '× prom.', place: 'Puntaje por lugar', share: 'Cuota prom.', score: 'Puntaje' },
    empty: 'Todavía no hay juegos que cuenten para el ranking en esta liga.'
  },

  host: {
    console: 'Consola del facilitador',
    run: 'Juego', teams: 'Equipos', cityTab: 'Ciudad', settings: 'Configuración',
    boardLink: 'Marcador para proyector',
    copyBoardLink: 'Copiar enlace',
    signInHint: 'Los equipos entran en {site} con el correo que agregaste y un código de 6 dígitos que les llega por correo.',
    notStartedTitle: 'Listo para empezar',
    monthOpen: 'El mes {n} está abierto',
    monthDone: 'El mes {n} de {total} está calculado',
    gameOver: 'El juego terminó',
    openMonth: 'Abrir el mes {n}',
    opened: 'El mes {n} está abierto. El temporizador está corriendo.',
    monthLength: '{minutes} min por mes',
    calcMonth: 'Calcular el mes {n}',
    calculated: 'El mes {n} está calculado.',
    confirmCalc: '¿Calcular el mes {n} ahora? Equipos sin decisión: {waiting}; se repetirá su última decisión.',
    submitted: 'Decisiones enviadas: {n} de {total}',
    addTeamsFirst: 'Primero agrega los correos de los equipos, en la pestaña Equipos.',
    profilesPending: 'Equipos que aún no llenan su nombre y restaurante: {n}. Pueden hacerlo mientras el mes 1 esté abierto.',
    finish: 'Terminar el juego y actualizar el ranking',
    finishEarly: '¿Terminar el juego ahora? Termina antes del mes {total}, así que no contará para el ranking.',
    finishConfirm: '¿Terminar el juego y actualizar el ranking?',
    finishedRated: 'El juego terminó y cuenta para el ranking.',
    finishedUnrated: 'El juego terminó. No cuenta para el ranking.',
    openReport: 'Abrir el informe',
    playAgain: 'Jugar de nuevo con los mismos equipos',
    playAgainConfirm: '¿Crear un juego nuevo con los mismos equipos y la misma configuración?',
    created: 'Juego creado. Código {code}.',
    rosterTitle: 'Equipos',
    rosterLead: 'Un equipo, un correo. Pega la lista: sirven saltos de línea, comas o espacios. La lista es la plantilla completa: los correos que quites salen del juego, salvo que el equipo ya haya jugado.',
    rosterEmails: 'Correos de los equipos',
    rosterSave: 'Guardar plantilla',
    rosterResult: 'Plantilla guardada: {added} agregados, {removed} eliminados.',
    rosterNotes: 'Sin cambios:',
    rosterWhy: {
      not_email: 'no es un correo electrónico',
      host: 'el facilitador no puede jugar en su propio juego',
      repeated: 'repetido',
      played: 'ya jugó; quitarlo rompería el historial del juego'
    },
    teamsTitle: 'Equipos en el juego ({n})',
    noTeams: 'Todavía no hay equipos.',
    viewAs: 'Jugar como',
    viewAsLead: '«Jugar como» abre la pantalla de un equipo: ve lo que ellos ven o juega por ellos en una práctica.',
    profilePending: 'Perfil pendiente',
    columns: { team: 'Equipo', money: 'Caja / ahorros', brand: 'Marca', capacity: 'Capacidad', loan: 'Préstamo', sent: 'Enviado' },
    cityLead: 'Tú juegas como la ciudad. Las multas, los impuestos y la venta de participaciones entran al presupuesto de la ciudad; los subsidios, los sueldos del empleo público y las recompras salen de él.',
    lastMonthNet: 'Último mes, neto',
    adjustTitle: 'Multa o subsidio a un equipo',
    amount: 'Monto, $', reason: 'Motivo', reasonPlaceholder: 'Lo verá el equipo',
    fine: 'Multa', grant: 'Subsidio', fined: 'Multa aplicada.', granted: 'Subsidio pagado.',
    pickTeam: 'Elige un equipo.',
    massTitle: 'A todos a la vez',
    massHint: 'Por equipo.',
    taxAll: 'Cobrar impuesto a cada restaurante abierto', grantAll: 'Dar subsidio a quienes están fuera del negocio',
    confirmTaxAll: '¿Cobrar {amount} a cada restaurante abierto?',
    confirmGrantAll: '¿Dar {amount} a cada equipo fuera del negocio?',
    massDone: 'Listo: equipos {n}, {total} en total.',
    sharesTitle: 'Participación de la ciudad',
    sharesLead: 'Cuánto de cada empresa es de la ciudad. El resto es de los equipos (participaciones) y de dueños privados. La ciudad recibe cada mes su parte de las utilidades de cada empresa.',
    cityPct: 'La ciudad posee, %',
    cityShareSaved: 'Ahora la ciudad posee el {pct} {inst}.',
    stakesTitle: 'Participaciones',
    stakesLead: 'Vende a un equipo parte de lo que posee la ciudad, recómprala o registra un trato entre equipos. El equipo paga o cobra el precio de inmediato; los dividendos llegan cada mes.',
    sell: 'La ciudad vende', buyback: 'La ciudad recompra', deal: 'Trato entre equipos',
    company: 'Empresa', buyer: 'Comprador', seller: 'Vendedor', holder: 'Del equipo',
    pct: 'Participación, %', price: 'Precio, $',
    stakeHint: 'En los últimos meses cada 1 % pagó unos {perPct} al año. Meses restantes: {left}; el {pct} pagaría unos {est} hasta el final.',
    cityOwns: 'La ciudad posee el {pct}.',
    stakeSubmit: 'Registrar',
    stakeDone: 'Participación registrada.',
    confirmStake: {
      sell: '¿Vender el {pct} {inst} a {buyer} por {price}?',
      buyback: '¿Recomprar el {pct} {inst} a {seller} por {price}?',
      deal: '¿{seller} vende el {pct} {inst} a {buyer} por {price}?'
    },
    gameInfo: 'Datos del juego',
    language: 'Idioma del juego',
    languageHint: 'Todos ven el juego en este idioma, salvo que elijan otro en el menú.',
    title: 'Nombre del juego', titlePlaceholder: 'p. ej. Cámara de Austin, sesión de otoño',
    organizer: 'Organizador', organizerPlaceholder: 'p. ej. Cámara de Comercio de Austin',
    scheduled: 'Fecha y hora', scheduledHint: 'En la zona horaria del juego.',
    timezone: 'Zona horaria',
    openBook: 'Después del final, mostrar a todos las decisiones de cada equipo',
    practiceLabel: 'Juego de práctica: no cuenta para el ranking',
    practiceLocked: 'No se puede cambiar después del mes 1.',
    league: 'Liga',
    leagueFixed: 'Liga {league} · {total} meses. La liga se fija al crear el juego.',
    sponsorTitle: 'Patrocinador (opcional)',
    sponsorLead: 'Aparece en el marcador como un anuncio claramente identificado. El patrocinador no participa en el juego.',
    sponsorName: 'Nombre del patrocinador', sponsorUrl: 'Sitio web (https://…)',
    logo: 'Logotipo', logoUpload: 'Subir archivo del logotipo', logoRemove: 'Quitar', logoNone: 'Sin logotipo',
    logoLink: 'O pega un enlace a la imagen', logoPreviewAlt: 'Vista previa del logotipo',
    logoWorking: 'Preparando el logotipo…', logoReady: 'Logotipo listo: se guarda con el juego.',
    logoFileBad: 'No pudimos leer ese archivo. Usa una imagen PNG, JPG, WebP o SVG.',
    logoChecking: 'Revisando el enlace…', logoOk: 'El enlace abre como imagen.',
    logoBad: 'Este enlace no abre como imagen. Mejor sube el archivo o usa un enlace directo a un PNG, JPG o SVG. Un archivo de Google Drive debe estar compartido con «Cualquier persona con el enlace».',
    logoHint: 'PNG, JPG, WebP o SVG de cualquier tamaño: recortamos los bordes vacíos y la reducimos para la web. Un fondo transparente se ve mejor. Subir el archivo es lo más seguro.',
    saved: 'Guardado.',
    economy: 'Economía',
    settingsLead: 'Los cambios aplican desde el próximo mes, para que los equipos decidan con las cifras con las que se les va a medir.',
    allowed: 'Permitido: {range}',
    configSave: 'Guardar para el próximo mes',
    configSaved: 'Guardado. Aplica desde el próximo mes.',
    configWhy: {
      not_editable: 'no se puede cambiar',
      not_number: 'no es un número',
      not_whole: 'debe ser un número entero',
      range: 'permitido de {min} a {max}'
    },
    badNumber: 'Revisa el número de «{name}».',
    nothingChanged: 'No cambió nada.',
    dangerTitle: 'Eliminar el juego',
    deleteLead: 'Solo se puede eliminar un juego sin meses calculados.',
    delete: 'Eliminar juego',
    deleteConfirm: '¿Eliminar este juego definitivamente?',
    deleted: 'Juego eliminado.',
    createTitle: 'Crear un juego',
    createLead: 'Después agregarás los correos de los equipos y abrirás el mes 1.',
    create: 'Crear juego'
  },

  admin: {
    title: 'Facilitadores',
    lead: 'Los facilitadores crean y dirigen juegos. Los administradores se definen en la configuración del proyecto (ADMIN_EMAILS).',
    add: 'Agregar facilitador', email: 'Correo del facilitador', addHint: 'Entra con este correo y un código, sin contraseña.',
    added: '{email} ahora es facilitador.', remove: 'Quitar', removed: '{email} ya no es facilitador.',
    removeConfirm: '¿Quitar a {email} de los facilitadores? Sus juegos se conservan.',
    admins: 'Administradores', adminsNote: 'Los administradores pueden dirigir cualquier juego y asignar facilitadores.',
    hosts: 'Facilitadores', none: 'Todavía no hay facilitadores.'
  },

  history: {
    title: 'Informe del juego',
    running: 'El juego sigue en curso: este informe se actualiza a medida que se calculan los meses.',
    summary: 'Tu resultado',
    place: 'Lugar',
    noMonths: 'Aún no se ha jugado ningún mes.',
    stakesHeld: 'Tus participaciones',
    csv: 'Descargar CSV',
    csvAll: 'Descargar CSV (todos los equipos)',
    shareLink: 'Copiar el enlace del informe para tu equipo',
    linkCopied: 'Enlace copiado: cualquiera que lo tenga puede ver este informe.',
    months: 'Mes a mes',
    monthDetails: 'Detalle del mes',
    served: 'Atendidos',
    cashEnd: 'Caja al cierre',
    loanEnd: 'Préstamo al cierre',
    savingsMark: '(ahorros)',
    decisions: 'Tus decisiones',
    auto: '(repetida)',
    autoNote: '«Repetida» significa que el equipo no envió decisión y se usó la anterior.',
    shifts: 'Turnos',
    qualityInvest: 'Calidad',
    allDecisions: 'Decisiones de todos los equipos',
    allDecisionsLead: 'Se abren después del final para que los equipos repasen el juego juntos.',
    decisionsCount: '{n} meses',
    decisionsCount_one: '{n} mes',
    hidden: 'Las decisiones de los otros equipos se abren después del final.',
    closedBook: 'El facilitador mantuvo privadas las decisiones de los otros equipos.',
    log: 'Movimientos de dinero',
    what: 'Concepto', amount: 'Monto', note: 'Nota',
    notes: {
      start_capital: 'Capital inicial',
      month_cash_flow: 'Resultado del mes {n}',
      dividends: 'Dividendos de tus participaciones',
      loan_out: 'Préstamo recibido',
      loan_repay: 'Pago anticipado del préstamo',
      loan_repay_closing: 'Préstamo liquidado al cerrar',
      transfer_to: 'Transferencia a {team}',
      transfer_from: 'Transferencia de {team}',
      stake_bought_city: 'Compra del {pct} {inst} a la ciudad',
      stake_sold_city: 'Venta del {pct} {inst} a la ciudad',
      stake_bought: 'Compra del {pct} {inst} a {team}',
      stake_sold: 'Venta del {pct} {inst} a {team}',
      unpaid_written_off: 'Cuentas impagas canceladas',
      business_closed: 'Negocio cerrado',
      cash_kept: 'Caja conservada al cerrar',
      left_game: 'Salida del juego',
      new_business: 'Apertura de un negocio nuevo',
      new_business_cash: 'Caja inicial del negocio nuevo',
      salary_to: 'Sueldo para {name}',
      salary_from: 'Sueldo de {team}',
      civil_salary: 'Sueldo del empleo público',
      civilSalaryMonths: 'Sueldo del empleo público por {n} meses'
    },
    kinds: {
      start_capital: 'Capital inicial', month_cash_flow: 'Resultado del mes', loan_out: 'Préstamo recibido',
      loan_repay: 'Pago del préstamo', transfer_in: 'Transferencia recibida', transfer_out: 'Transferencia enviada',
      civil_salary: 'Sueldo público', employer_salary: 'Sueldo', settlement: 'Cierre del negocio',
      bankruptcy: 'Quiebra', reopen: 'Restaurante nuevo', fine: 'Multa de la ciudad', grant: 'Subsidio de la ciudad',
      city_tax: 'Impuesto municipal', dividend: 'Dividendos', stake_buy: 'Compra de participación', stake_sell: 'Venta de participación'
    }
  },

  guide: {
    title: 'Guía',
    print: 'Imprimir',
    contents: 'Contenido',
    lead: 'Todas las cifras son las reglas vigentes de este juego. Si el facilitador cambia una regla, la guía se actualiza cuando el cambio entra en vigor.',
    costs: {
      item: 'Costo', amount: 'Monto', who: 'Se paga a',
      perMeal: '{cogs} por comida (+{qadd} por punto de calidad)', suppliers: 'Proveedores', staff: 'Tu personal',
      fixed: 'Costos fijos', perShift: '{cost} por turno adicional', perPoint: '{upkeep} por punto de calidad',
      yourCall: 'Publicidad e inversión en calidad', decide: 'lo que tú decidas'
    },
    channels: {
      seo: ['Arranque lento: paga algo {seoRamp} meses seguidos y solo entonces se activa. Después se sostiene con pequeñas recargas (se desgasta {seoDecay} al mes). Presupuesto típico: {seoRef}.'],
      promo: ['Solo funciona el mes que pagas. No se acumula: si dejas de pagar, desaparece. Presupuesto típico: {promoRef}.'],
      maps: ['Empieza a funcionar el mes **siguiente** al pago, luego se acumula y se desgasta despacio ({mapsDecay} al mes). Presupuesto típico: {mapsRef}.'],
      social: ['Funciona de inmediato, pero es lo que la gente olvida más rápido: cada mes se pierde el {socialDecay} del efecto. Publica con constancia: una sola vez casi no sirve. Presupuesto típico: {socialRef}.'],
      outdoor: ['Una colocación de al menos {outdoorMin} funciona exactamente {outdoorMonths} meses y luego se apaga de golpe. Paga otra vez para renovarla. Presupuesto típico: {outdoorRef}.'],
      affiliate: ['No trae clientes nuevos. Mientras pagues al menos {affiliateMin} al mes, los clientes que atiendes gastan {affiliateBonus} más. Pagar más del mínimo no suma nada.']
    },
    s: {
      goal: {
        title: 'Cómo ganar',
        body: [
          'Diriges un restaurante. Los otros equipos dirigen restaurantes en la misma ciudad y compiten por los mismos clientes. Cada mes defines tu precio, publicidad, personal y calidad; el facilitador calcula el mes y todos ven los resultados en el marcador.',
          'Gana el equipo con más **dinero** al final: no el de más ingresos ni el de más cuota de mercado. Tu resultado es tu multiplicador de capital: dinero al final ÷ tu capital inicial de {startCapital}.',
          '> La lección más grande es de dónde sale el dinero. Pelear por los mismos clientes vuelve rojas las aguas; mejor comida, precios justos y acuerdos inteligentes las vuelven azules. Consulta «Océano rojo u océano azul».',
          'Este juego: liga {league}, {total} meses, unos {minutes} minutos por mes.'
        ],
        practice: 'Este es un juego de práctica: no cuenta para el ranking.'
      },
      ocean: {
        title: 'Océano rojo u océano azul',
        body: [
          'En la mayoría de los mercados todos pelean por los mismos clientes y el agua se vuelve roja: los precios caen, los presupuestos de publicidad suben y los negocios pierden dinero juntos. En Market Game se ve en una sola tarde: la vista Economía del marcador muestra el color del agua cada mes.',
          '**Qué vuelve rojas las aguas**',
          '- **Guerra de precios.** Bajar de {pRef} le quita clientes a la competencia, pero cada cliente deja menos. Cuando todos bajan, nadie gana clientes: la ciudad solo pierde margen.',
          '- **Carrera publicitaria.** La publicidad sobre todo mueve clientes de un restaurante a otro. Si todos duplican el presupuesto, las cuotas quedan igual y todos pagan más.',
          '- **Demasiados restaurantes.** {marketBase} clientes al mes alcanzan, a un precio justo, para alrededor de {feedsText} con utilidades. Si hay más restaurantes, todos pierden.',
          '**Qué las vuelve azules**',
          '- **La calidad hace crecer todo el mercado:** +{gain} clientes por cada punto de calidad promedio en la ciudad. Es la palanca que agranda el pastel para todos.',
          '- **Un precio justo por buena comida** hace rentable a cada cliente y fortalece tu marca.',
          '- **Salir a tiempo de las aguas rojas:** cierra antes de que las pérdidas se coman tu capital, vende tus habilidades a otro equipo o compra una participación del arrendador, la aseguradora, la empresa de servicios o el banco: ellos ganan con todo el mercado.',
          '- **Crear aguas azules juntos:** habla con otros equipos entre meses. Inviertan juntos en calidad, hagan promociones conjuntas, fusiónense: un equipo se une a otro a cambio de un sueldo o de parte de las utilidades. Cuando gana toda la ciudad, gana cada equipo.',
          '> En el juego se vale negociar cualquier cosa. En los negocios reales de EE. UU., ponerse de acuerdo en precios con la competencia es ilegal (leyes antimonopolio). El camino legal a las aguas azules es ser diferente, ser mejor y hacer crecer el mercado.',
          'La meta de fondo: después de unos cuantos juegos ves cuándo y por qué el agua se vuelve roja, y aprendes a volverla azul.'
        ]
      },
      month: {
        title: 'Cómo transcurre un mes',
        body: [
          '- El facilitador abre el mes. El temporizador de arriba muestra cuánto tiempo tienes.',
          '- Envía tu decisión. Puedes cambiarla hasta que termine el tiempo.',
          '- El facilitador calcula el mes. Los resultados, las novedades y el marcador se actualizan en todas las pantallas.',
          '- ¿Se te acabó el tiempo? Se repite tu última decisión, ajustada al efectivo que tengas. No hacer nada también es una jugada, casi siempre mala.',
          'Entre meses: habla con otros equipos, pide prestado o paga, envía dinero y haz tratos.'
        ]
      },
      pnl: {
        title: 'Tu mes en dos líneas',
        body: [
          '= ingresos − alimentos e insumos − renta − seguro − servicios − nómina − turnos, calidad, publicidad − intereses del préstamo − impuesto sobre utilidades = utilidad neta',
          '= utilidad neta − abono a capital del préstamo = cambio en tu caja',
          'Los costos fijos se pagan pase lo que pase: **{fixedTotal} al mes**. Al precio de referencia de {pRef}, cada comida te deja {margin} después del costo de alimentos, así que necesitas unos **{breakEven} clientes al mes** solo para salir tablas.'
        ]
      },
      market: {
        title: 'El mercado',
        body: [
          'La ciudad empieza con **{marketBase} clientes al mes**, repartidos entre todos los restaurantes. El mercado no crece con el número de equipos: más restaurantes significan menos clientes para cada uno.',
          '- La buena comida hace crecer el mercado: **+{gain}** clientes por cada punto de la calidad **promedio** de la ciudad. Un equipo invierte y todos ganan.',
          '- Los precios bajos animan a la gente a salir: con un precio promedio bajo el mercado crece hasta ×{catMax}; con uno alto se encoge hasta ×{catMin}.',
          '- A los clientes que superan tu capacidad se les rechaza, y eso daña tu reputación.'
        ]
      },
      choice: {
        title: 'Cómo eligen los clientes',
        body: [
          'Cada restaurante recibe una rebanada del mercado proporcional a qué tan atractivo es:',
          '= atractivo = (1 + ½ marca + ½ calidad + publicidad) × factor de precio × reputación',
          '= tus clientes = mercado × tu atractivo ÷ atractivo de todos',
          'Atiendes a tantos como te permita tu capacidad.'
        ]
      },
      price: {
        title: 'Precio',
        body: [
          'Precio de referencia: **{pRef}**. Puedes cobrar de {floor} a {ceiling}.',
          '- Los clientes se fijan en el precio: 10 % más barato te hace cerca de 26 % más atractivo; 10 % más caro, cerca de 19 % menos.',
          '- Arriba de **{softCap}** está el punto de dolor: los clientes se van de golpe, no poco a poco.',
          '- Cada comida te cuesta {cogs} en alimentos e insumos, más si subes la calidad. No cobres menos que eso.',
          '- Un precio que se siente justo para tu calidad hace crecer tu marca más rápido.'
        ]
      },
      capacity: {
        title: 'Capacidad y turnos',
        body: [
          'Puedes atender **{capacityBase} clientes al mes**. Cada turno adicional suma {step} clientes de capacidad por {cost} al mes.',
          '- Cambia un turno por mes, de {min} a +{max}.',
          '- Recortar por debajo de la base baja la capacidad, pero no la nómina.',
          '- ¿Más clientes que lugares? Los demás se van y tu reputación baja.'
        ]
      },
      quality: {
        title: 'Calidad',
        body: [
          'Una inversión única: cada **{unit}** compra +1 punto de calidad, hasta 3.',
          '- La calidad se desgasta {decay} al mes y su mantenimiento cuesta {upkeep} al mes por punto.',
          '- Mejor comida cuesta más: +{qadd} al costo de alimentos por punto.',
          '- La calidad te hace más atractivo, ayuda a que crezca tu marca y hace crecer todo el mercado.'
        ]
      },
      marketing: {
        title: 'Publicidad',
        body: [
          'Seis canales, cada uno con su carácter. Los rendimientos bajan: cuatro veces el presupuesto da el doble de efecto, no el cuádruple. Repartir el dinero entre canales suele ser mejor que ponerlo todo en uno.'
        ]
      },
      brand: {
        title: 'Marca y reputación',
        body: [
          '- **Marca** (0–3): crece con clientes contentos; atiende más de tu parte justa a un precio justo. Se desgasta {brandDecay} al mes.',
          '- **Reputación** (0.6–1.0): multiplica tu atractivo. Rechazar clientes la baja; se recupera sola, despacio.',
          '- **Calidad** (0–3): lo que compraste con inversión.'
        ]
      },
      costs: {
        title: 'Costos mensuales',
        body: [
          'La renta va al arrendador, el seguro a la aseguradora y los servicios a la empresa de servicios. Consulta «Arrendador, banco, aseguradora, servicios» más abajo: puedes ser dueño de una parte de ellos.'
        ]
      },
      tax: {
        title: 'Impuesto sobre utilidades',
        body: [
          'El **{taxRate}** de tus utilidades va al presupuesto de la ciudad.',
          'Las pérdidas se arrastran: después de una pérdida no pagas impuestos hasta que tus utilidades posteriores la cubran.'
        ],
        body0: [
          'En este momento no hay impuesto sobre utilidades en este juego. Las pérdidas se siguen registrando, por si la ciudad crea un impuesto.'
        ]
      },
      bank: {
        title: 'Banco y préstamos',
        body: [
          '- Un préstamo de arranque de hasta **{l1}** está disponible desde el primer mes, incluso antes de que se calcule el mes 1.',
          '- Dos meses seguidos con flujo de caja positivo suben el límite a **{l3}** ({l2} después de un pago atrasado). El límite nunca baja.',
          '- El interés es de {rate} al año ({monthly} al mes) sobre lo que debes. El capital se paga en {term} pagos mensuales iguales; un préstamo nuevo reinicia el calendario.',
          '- Puedes pagar por adelantado cuando quieras.',
          '> Un préstamo no es ingreso: tu capital es la caja **menos** lo que debes. Pide prestado para crecer, no para parecer rico: un préstamo tomado en el último mes solo suma intereses.',
          'El banco de este juego es ficticio y no es una oferta de crédito.'
        ]
      },
      cash: {
        title: 'Si te quedas sin efectivo',
        body: [
          'Si tu caja queda por debajo de cero al cierre de un mes, el restaurante cierra. Lo que todavía le debes al banco se cancela: esa pérdida es del banco. Luego eliges qué hacer:',
          '- **Empleo público**: {civil} al mes del presupuesto de la ciudad, pagado en automático.',
          '- **Trabajo independiente**: vives de transferencias de otros equipos. Negocia.',
          '- **Emplearte**: di cuál es tu oficio y ofrécelo a un equipo por un sueldo que te paga cada mes.',
          'Volver al juego: ahorra **{reopen}** y abre un restaurante nuevo desde cero; marca, reputación, calidad y publicidad empiezan en cero, y tus ahorros se vuelven la nueva caja. Puedes cambiar de camino cuando quieras; los ahorros se quedan contigo.',
          'También puedes cerrar el negocio a propósito: conservas tu caja después de liquidar el préstamo.'
        ]
      },
      deals: {
        title: 'Tratos y transferencias',
        body: [
          'Envía dinero a cualquier equipo, hasta lo que tengas en caja: paga un servicio, ayuda a un aliado, compra parte de su negocio. El facilitador ve cada transferencia.'
        ]
      },
      owners: {
        title: 'Arrendador, banco, aseguradora, servicios y participaciones',
        body: [
          'La renta, los intereses, el seguro y los servicios que pagan los restaurantes son ingresos de cuatro empresas. Cada mes cada empresa reparte sus utilidades entre sus dueños según su participación, después de cubrir sus propias pérdidas anteriores. El banco pierde los préstamos que los equipos en quiebra nunca pagaron.',
          'La ciudad es dueña de una parte de cada empresa (el facilitador decide cuánto); el resto es de dueños privados. La ciudad puede vender parte de lo suyo a un equipo: desde entonces ese equipo recibe cada mes su parte de las utilidades como dividendos. Las recompras y los tratos entre equipos también pasan por el facilitador.',
          '> Las participaciones no cuentan en tu capital final: solo cuenta el dinero. Vale la pena comprar una participación si sus dividendos la pagan antes de que termine el juego.',
          'Cuando un equipo sale del juego, sus participaciones regresan a la ciudad.',
          'Una jugada clásica: pedir un préstamo, comprar una participación de la aseguradora y luego convencer a la ciudad de subir las primas de seguro.'
        ]
      },
      city: {
        title: 'La ciudad y el facilitador',
        body: [
          'El facilitador juega como la ciudad. La ciudad cobra el impuesto sobre utilidades, multas, impuestos municipales, su parte de las utilidades de las empresas y el dinero de la venta de participaciones. Paga subsidios, sueldos del empleo público y recompras de participaciones. Su presupuesto está en el marcador.',
          'El cabildeo funciona: convence al facilitador de cambiar las reglas: renta, seguro, servicios, nómina, impuestos, tasa del préstamo. Los cambios aplican desde el mes siguiente y se anuncian antes.'
        ]
      },
      board: {
        title: 'El marcador',
        body: [
          '- El capital y los ingresos se ven para todos, incluidos los equipos fuera del negocio.',
          '- La cuota de mercado, los clientes y la marca, solo para los equipos con restaurante abierto.',
          '- Economía muestra el mercado, el presupuesto de la ciudad y las cuatro empresas; «A dónde fue el dinero» sigue cada dólar que pagaron los clientes.'
        ]
      },
      scoring: {
        title: 'Ganar y el ranking',
        body: [
          '- El **capital** es tu dinero al final menos lo que todavía le debes al banco: la caja menos el saldo del préstamo, o los ahorros si estás fuera del negocio.',
          '- **Multiplicador** = capital ÷ {startCapital}. El **lugar** se define por capital.',
          '- El ranking de la liga suma todos los juegos que cuentan: puntaje = 0.7 × multiplicador promedio + 0.9 × puntaje promedio por lugar (1 para el primer lugar, 0 para el último).',
          '- Un juego cuenta si se juega hasta su último mes y no es de práctica. Un equipo cuenta si jugó al menos tres cuartas partes de los meses ({minMonths} de {total}).'
        ]
      },
      leagues: {
        title: 'Ligas',
        body: [
          '- **Inicio**: 12 meses, para quienes están por abrir un negocio.',
          '- **Crecimiento**: 24 meses, para dueños de un negocio en marcha.',
          '- **Élite**: 36 meses, para directivos y equipos de gerencia.'
        ],
        current: 'Estás jugando en la liga {league}.'
      }
    }
  },

  csv: {
    month: 'Mes', status: 'Estado', team: 'Equipo', inBusiness: 'En el negocio', price: 'Precio',
    served: 'Clientes atendidos', lost: 'Clientes rechazados', sharePct: 'Cuota de mercado %', revenue: 'Ingresos',
    cogs: 'Alimentos e insumos', rent: 'Renta', insurance: 'Seguro', utilities: 'Servicios y otros', payroll: 'Nómina',
    shifts: 'Turnos adicionales', qualityUpkeep: 'Mantenimiento de calidad', qualityInvest: 'Inversión en calidad',
    advertising: 'Publicidad', ebit: 'Utilidad operativa', interest: 'Intereses del préstamo', pbt: 'Utilidad antes de impuestos',
    tax: 'Impuesto sobre utilidades', profit: 'Utilidad neta', principal: 'Abono a capital del préstamo', cashFlow: 'Flujo de caja',
    dividends: 'Dividendos', cashEnd: 'Caja / ahorros al cierre del mes', loanEnd: 'Saldo del préstamo al cierre del mes',
    capital: 'Capital (caja − préstamo)', brand: 'Marca', reputation: 'Reputación', quality: 'Calidad',
    capacity: 'Capacidad', sent: 'Decisión enviada por el equipo', cash: 'Caja / ahorros', profitIncome: 'Utilidad / ingresos',
    repeated: 'Repetida automáticamente', shiftChange: 'Cambio de turnos',
    yes: 'sí', no: 'no', noRepeated: 'no (repetida)'
  },

  tz: {
    eastern: 'Este (Nueva York)', central: 'Centro (Chicago)', mountain: 'Montaña (Denver)',
    arizona: 'Arizona (Phoenix)', pacific: 'Pacífico (Los Ángeles)', alaska: 'Alaska (Anchorage)',
    hawaii: 'Hawái (Honolulu)', atlantic: 'Atlántico (Puerto Rico)', toronto: 'Toronto', mexicoCity: 'Ciudad de México',
    saoPaulo: 'São Paulo', london: 'Londres', berlin: 'Berlín', dubai: 'Dubái', bangkok: 'Bangkok', tokyo: 'Tokio',
    sydney: 'Sídney', utc: 'UTC'
  },

  charts: {
    legend: 'Leyenda', highlight: 'Resaltar {name}', other: 'Otros', nothing: 'Nada este mes'
  },

  statuses: {
    active: 'Abierto', bankrupt: 'En quiebra', civil_service: 'Empleo público', freelance: 'Independiente',
    custom_employed: 'Empleado', left: 'Salió', setup: 'Sin empezar', running: 'En curso', finished: 'Terminado'
  },

  errors: {
    auth_required: 'Vuelve a iniciar sesión.',
    not_registered: 'Este correo todavía no está en ningún juego. Pide al facilitador que lo agregue.',
    bad_email: 'Eso no parece un correo electrónico.',
    not_in_game: 'No estás en la plantilla de este juego.',
    not_host: 'Solo el facilitador puede hacer eso.',
    not_admin: 'Solo un administrador puede hacer eso.',
    game_not_found: 'No se encontró el juego.',
    player_not_found: 'No se encontró el equipo.',
    round_closed: 'El mes no está abierto: espera al facilitador.',
    price_too_low: 'El precio debe estar entre {min} y {max}.',
    price_too_high: 'El precio debe estar entre {min} y {max}.',
    bad_price: 'Escribe un precio.',
    insufficient_cash: 'No te alcanza: tienes {available}.',
    negative_spend: 'Los montos no pueden ser negativos.',
    shifts_step: 'Puedes agregar o quitar un turno por mes.',
    shifts_out_of_range: 'Ese número de turnos no está permitido.',
    no_credit_yet: 'El crédito todavía no está disponible.',
    over_limit: 'Eso supera tu límite de crédito. Disponible: {available}.',
    no_loan: 'No tienes préstamo que pagar.',
    bad_amount: 'Revisa el monto.',
    bad_params: 'Revisa los campos.',
    self_transfer: 'No puedes enviarte dinero a ti mismo.',
    recipient_not_found: 'Ese equipo ya no está en el juego.',
    not_active: 'Solo un restaurante abierto puede hacer eso.',
    invalid_path: 'Elige un camino.',
    invalid_state: 'Eso no es posible en este momento.',
    empty_profession: 'Escribe tu oficio.',
    not_eligible: 'Solo los equipos fuera del negocio pueden abrir un restaurante nuevo.',
    not_enough_savings: 'Necesitas {needed} de ahorros para abrir un restaurante nuevo.',
    not_custom_path: 'Primero elige «Emplearte».',
    self_employer: 'No puedes contratarte a ti mismo.',
    employer_not_found: 'Ese equipo no está en el juego.',
    employer_not_active: 'El restaurante de ese equipo está cerrado.',
    not_your_employee: 'Esa persona no trabaja para ti.',
    already_paid: 'Ya se pagó este mes.',
    game_finished: 'Este juego ya terminó.',
    already_open: 'El mes ya está abierto.',
    no_open_round: 'No hay un mes abierto para calcular.',
    no_players: 'Primero agrega al menos un equipo.',
    city_has_less: 'La ciudad solo posee el {cityPct}%: no puede vender más.',
    not_enough_stake: 'Ese equipo solo posee el {has}%.',
    over_100: 'La propiedad no puede pasar del 100%. La ciudad puede poseer como máximo el {maxCityPct}%.',
    bad_pct: 'Escribe una participación entre 0 y 100%.',
    bad_institution: 'Elige una empresa.',
    player_cannot_trade: 'Ese equipo no puede negociar participaciones ahora.',
    player_left: 'Ese equipo salió del juego.',
    round_open: 'Primero calcula el mes abierto.',
    game_has_history: 'No se pueden eliminar juegos con meses jugados.',
    game_started: 'Eso no se puede cambiar después de que empezó el juego.',
    empty_title: 'Ponle nombre al juego.',
    bad_league: 'Elige una liga.',
    bad_url: 'Los enlaces deben empezar con https://',
    bad_logo: 'Ese logotipo no se puede usar. Sube un archivo PNG o JPG.',
    bad_timezone: 'Elige una zona horaria.',
    bad_language: 'Elige un idioma.',
    bad_date: 'Revisa la fecha.',
    too_many_teams: 'Hasta {max} equipos por juego.',
    restaurant_taken: 'Otro equipo ya usa ese nombre de restaurante.',
    bad_state: 'Elige un estado.',
    bad_country: 'Escribe tu país.',
    bad_location: 'Dinos dónde haces negocios.',
    empty: 'Llena todos los campos.',
    bad_code: 'Escribe el código del juego.',
    bad_game: 'No se encontró el juego.',
    report_not_found: 'Este enlace de informe no funciona.',
    duplicate_request: 'Ya está hecho.',
    unknown_action: 'Algo está desactualizado: recarga la página.',
    rate_limited: 'Demasiados intentos. Espera un minuto e intenta de nuevo.',
    bad_code_otp: 'Ese código no funcionó. Revísalo o pide uno nuevo.',
    network: 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.',
    server_error: 'Algo salió mal de nuestro lado. Intenta de nuevo en un momento.'
  }
};
