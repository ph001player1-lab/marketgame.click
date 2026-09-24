// Все тексты интерфейса — здесь, в одном словаре. Испанский (его продаёт
// marketgame.biz) добавится вторым словарём без правок кода.
//
// t('decision.title') → строка; t('errors.over_limit', { available: '$30,000' })
// подставляет значения в {скобки}.

const EN = {
  brand: 'Market Game',
  gameName: 'Capture the Market',

  common: {
    loading: 'Loading…',
    retry: 'Try again',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    send: 'Send',
    done: 'Done',
    back: 'Back',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    month: 'Month',
    monthOf: 'Month {n} of {total}',
    notStarted: 'Not started',
    finished: 'Finished',
    practice: 'Practice',
    rated: 'Rated',
    notRated: 'Not rated',
    copy: 'Copy',
    copied: 'Copied',
    signOut: 'Sign out',
    myGames: 'My games',
    menu: 'Menu',
    you: 'You',
    team: 'Team',
    teams: 'Teams',
    total: 'Total',
    none: 'None',
    from: 'from',
    perMonth: '/mo',
    city: 'City',
    private: 'Private owners',
    sponsoredBy: 'Sponsored by',
    sponsorNote: 'The sponsor does not take part in the game. Loans, rates and terms in the game are fictional and are not an offer of credit.',
    serverTime: 'Server time'
  },

  leagues: {
    start: 'Start', growth: 'Growth', elite: 'Elite',
    startWho: 'People about to start a business',
    growthWho: 'Owners of a running business',
    eliteWho: 'Executives and management teams'
  },

  tabs: {
    business: 'Business', console: 'Console', board: 'Scoreboard', guide: 'Guide'
  },

  login: {
    title: 'Sign in',
    lead: 'Use the email your host added to the game. We\'ll send you a 6-digit code — no password needed.',
    email: 'Email',
    sendCode: 'Send me a code',
    codeSent: 'We sent a 6-digit code to {email}. It works for one hour.',
    code: 'Code from the email',
    verify: 'Sign in',
    otherEmail: 'Use another email',
    resend: 'Send a new code',
    noEmail: 'No email? Check your spam folder or ask your host to confirm the address.',
    testMode: 'Test mode: any 6 digits work.'
  },

  home: {
    title: 'My games',
    playing: 'Games I play',
    hosting: 'Games I host',
    noGames: 'You are not in any game yet. Your host will add your email to a game.',
    noHosted: 'No games yet. Create the first one.',
    newGame: 'Create a game',
    open: 'Open',
    report: 'Report',
    place: 'Place {place} of {rivals}',
    capital: 'Capital',
    multiplier: 'Multiplier',
    share: 'Market share',
    hostsLink: 'Hosts',
    ratingLink: 'Rating'
  },

  profile: {
    title: 'Welcome to the game',
    lead: 'Tell the other teams who you are. They see your name and restaurant, never your email.',
    name: 'Your name',
    restaurant: 'Restaurant name',
    where: 'Where do you do business?',
    inState: 'In one state',
    multistate: 'Across the U.S. (several states)',
    international: 'Internationally',
    state: 'State',
    country: 'Country',
    start: 'Start playing',
    edit: 'Edit profile'
  },

  header: {
    cash: 'Cash',
    savings: 'Savings',
    timerOpen: 'Decisions close in',
    waiting: 'Waiting for the host',
    impersonating: 'Host view: you are playing as {team}',
    backToConsole: 'Back to console'
  },

  notices: {
    title: 'News for you',
    gotIt: 'Got it'
  },

  upcoming: {
    title: 'From next month',
    keys: {
      ROUND_DURATION_MIN: 'Month length, min', RENT: 'Rent', INSURANCE: 'Insurance',
      UTILITIES: 'Utilities & other', PAYROLL_BASE: 'Payroll', START_CAPITAL: 'Starting capital',
      CIVIL_SERVICE_SALARY: 'Government job salary', REOPEN_THRESHOLD: 'Savings to reopen',
      P_REF: 'Reference price', MARKET_SIZE_PER_PLAYER: 'Base market, guests',
      MARKET_QUALITY_GAIN: 'Market growth per quality point', LOAN_RATE_ANNUAL: 'Loan rate',
      LOAN_TERM_MONTHS: 'Loan term, months', PROFIT_TAX_RATE: 'Profit tax'
    }
  },

  stats: {
    brand: 'Brand', reputation: 'Reputation', quality: 'Quality', capacity: 'Capacity',
    guestsMo: 'guests/mo', lossCf: 'Losses to cover before tax'
  },

  decision: {
    title: 'Your decisions for month {n}',
    closed: 'Decisions are closed. Talk strategy with other teams — the form opens when the host starts the month.',
    notStarted: 'The game hasn\'t started yet. The form opens when the host starts month 1.',
    over: 'The game is over. See the final results on the scoreboard.',
    sent: 'Decision sent. You can change it until the timer runs out.',
    sentAt: 'Last sent {time}',
    price: 'Price per meal',
    priceHint: 'Allowed from {min} to {max}. Above {soft} guests drop off sharply.',
    marketing: 'Marketing — split your budget by channel',
    shifts: 'Staff shifts',
    shiftsMinus: 'Cut one shift',
    shiftsSame: 'No change',
    shiftsPlus: 'Add one shift',
    shiftsHint: 'One shift = {cap} guests of capacity for {cost}/mo. Now: {shifts} extra shift(s), capacity {capacity}.',
    quality: 'Invest in quality (one time)',
    qualityHint: '{unit} buys +1 quality point (max 3). Upkeep {upkeep}/mo per point.',
    totalSpend: 'Spending this month: {total} of {cash} in cash',
    overCash: 'That is more than your cash.',
    submit: 'Send decision',
    resubmit: 'Update decision',
    perMonthPlaceholder: '$ this month'
  },

  channels: {
    seo: { name: 'SEO', blurb: 'Needs 3 months in a row before it kicks in. After that it holds with little upkeep.' },
    promo: { name: 'Street promo', blurb: 'Flyers and promoters. Works only in the month you pay — stop paying and it\'s gone.' },
    maps: { name: 'Google Maps', blurb: 'Starts working the month after you pay, then fades slowly.' },
    social: { name: 'Social media', blurb: 'Works right away but people forget fast. Keep it regular.' },
    outdoor: { name: 'Billboards', blurb: 'One placement (at least {min}) lasts exactly {months} months, then drops to zero.' },
    affiliate: { name: 'Loyalty program', blurb: 'Brings no new guests. Adds {bonus} to revenue from the guests you serve while you pay at least {min} a month.' },
    badges: {
      seoRamp: '{n} of {total} months', seoOn: 'working', mapsOn: 'working', socialOn: 'active',
      outdoorUntil: 'until month {n}', affiliateOn: 'active', off: 'off'
    }
  },

  pl: {
    title: 'Month {n} results',
    served: 'served', lost: 'turned away',
    revenue: 'Revenue', cogs: 'Food & supplies', gross: 'Gross profit',
    rent: 'Rent', insurance: 'Insurance', utilities: 'Utilities & other', payroll: 'Payroll',
    shifts: 'Extra shifts', qualityUpkeep: 'Quality upkeep', qualityInvest: 'Quality investment',
    marketing: 'Marketing', ebit: 'Operating profit', interest: 'Loan interest',
    pbt: 'Profit before tax', tax: 'Profit tax', profit: 'Net profit',
    principal: 'Loan principal paid', cashFlow: 'Cash flow', dividends: 'Dividends from your stakes',
    cashAfter: 'Cash at month end', share: 'Market share', byChannel: 'Marketing by channel',
    none: 'No results yet — they appear after the first month.'
  },

  bank: {
    title: 'Bank',
    balance: 'Loan balance', rate: 'Rate', nextPayment: 'Next payment (principal + interest)',
    termLeft: 'Payments left', available: 'Available to borrow', limit: 'Credit limit',
    noCredit: 'Credit opens after your first month. The limit grows by itself: two months in a row of positive cash flow raise it.',
    borrow: 'Borrow', repay: 'Repay early', amount: 'Amount, $',
    note: 'The bank in this game is fictional.',
    received: 'Loan received: {amount}.',
    repaid: 'Repaid {amount}.'
  },

  transfer: {
    title: 'Send money to another team',
    lead: 'Out of your cash. Useful for deals, helping an ally or buying a share of their business.',
    to: 'Recipient', amount: 'Amount, $', send: 'Send', nobody: 'No other teams yet.'
  },

  stakes: {
    title: 'Your stakes',
    lead: 'You own part of these companies and get your share of their profit every month.',
    none: 'You own no stakes. The city can sell you part of the landlord, the bank, the insurance company or utilities — ask the host.',
    lastMonth: 'last month: {amount}'
  },

  institutions: {
    landlord: 'Landlord', bank: 'Bank', insurer: 'Insurance company', utility: 'Utilities',
    landlordWhat: 'owns the restaurant buildings, collects rent',
    bankWhat: 'lends money, earns interest, loses unpaid loans',
    insurerWhat: 'collects insurance premiums',
    utilityWhat: 'power, water, waste, card fees and other services'
  },

  employees: {
    title: 'Your employees',
    wants: '{name} wants to work for you as {job} for {salary}/mo',
    approve: 'Hire', reject: 'Decline', pay: 'Pay {salary}', paid: 'Paid this month',
    approved: 'Works for you'
  },

  career: {
    title: 'Close the business and do something else',
    lead: 'You keep your cash after paying off the loan. If the loan is bigger than your cash, you leave without debt — that is the bank\'s loss. The restaurant closes for good; you can open a new one later.',
    civil: 'Government job', civilWhat: '{salary}/mo from the city budget, automatically.',
    freelance: 'Freelance', freelanceWhat: 'Live on transfers from other teams. Negotiate.',
    custom: 'Get hired', customWhat: 'Name your trade and offer it to a team for a salary.',
    end: 'Leave the game', endWhat: 'You stop playing. Your stakes go back to the city.',
    profession: 'Your trade, e.g. Chef', confirm: 'Confirm',
    confirmClose: 'Close your restaurant and switch to “{path}”? This can\'t be undone.',
    confirmEnd: 'Leave the game for good?'
  },

  life: {
    bankruptTitle: 'Your restaurant ran out of cash',
    bankruptLead: 'The business is closed. Choose what to do next — you can come back with a new restaurant once you save {threshold}.',
    civilTitle: 'You have a government job',
    freelanceTitle: 'You are freelancing',
    customTitle: 'You work as {job}',
    savings: 'Savings', threshold: 'Needed to reopen', toReopen: 'Needed to open a new restaurant: {threshold}',
    reopen: 'Open a new restaurant', reopenWhat: 'Fresh start: brand, reputation, quality and ads begin from zero. Your savings become the new business cash.',
    salary: 'Salary {salary}/mo, paid when each month is calculated.',
    offer: 'Offer your work to a team', employer: 'Team', salaryAsk: 'Monthly salary, $',
    offerSend: 'Send offer', offerPending: 'Waiting for {team} to answer.',
    offerApproved: 'You work for {team} for {salary}/mo.', paidThisMonth: 'Paid this month.',
    switchPath: 'Switch to another path',
    leftTitle: 'You left this game',
    leftLead: 'Thanks for playing! You can still watch the scoreboard.'
  },

  board: {
    title: 'Scoreboard',
    views: { teams: 'Teams', economy: 'Economy', money: 'Where the money went', rating: 'Rating' },
    metrics: {
      cash: 'Cash', profit: 'Profit', marketSharePct: 'Market share', served: 'Guests served',
      price: 'Price', brand: 'Brand', reputation: 'Reputation', quality: 'Quality',
      capacity: 'Capacity', marketingTotal: 'Advertising', qualityInvest: 'Quality investment',
      tax: 'Profit tax', dividends: 'Dividends'
    },
    metricNotes: {
      cash: 'Cash in the restaurant at month end. For teams out of business — their savings.',
      profit: 'Net profit after interest and tax. For teams out of business — their income.',
      marketSharePct: 'Share of all guests in town that the restaurant served.',
      served: 'Guests served; guests beyond capacity were turned away.',
      price: 'Price per meal.',
      brand: '0 to 3. Grows from happy guests, fades every month.',
      reputation: '0.6 to 1.0. Drops when guests are turned away.',
      quality: '0 to 3. Bought with investment, fades slowly.',
      dividends: 'Profit share from stakes in the landlord, bank, insurer and utilities.'
    },
    metric: 'Show',
    you: '(you)',
    legend: 'Teams — click one to highlight it',
    otherTeams: 'Other teams',
    offBusiness: 'out of business',
    mo: 'Mo',
    chartLabel: '{metric} by month for {n} teams. The Table button shows the exact numbers.',
    showTable: 'Table',
    showChart: 'Chart',
    afterMonth: 'After month {n}',
    beforeStart: 'Before month 1',
    market: 'market {guests} guests',
    teamsCount: '{n} teams',
    empty: 'No results yet — the scoreboard fills in after the first month.',
    standings: 'Standings',
    capital: 'Capital',
    lastMonth: 'Last month',
    share: 'Share',
    guests: 'Guests',
    marketTitle: 'Market size, guests a month',
    marketWhy: 'Starts at {base} guests a month. Grows {gain} for every point of average quality in town. Low average prices bring more guests, high prices fewer.',
    cityTitle: 'City budget',
    cityBalance: 'Balance {amount}',
    cityWhat: 'Income above zero, spending below. The city collects profit tax, fines, city taxes, its share of company profits and money from stake sales. It pays grants, government salaries and stake buybacks.',
    citySeries: {
      profitTax: 'Profit tax', companies: 'Share of company profits',
      otherIncome: 'Fines, city taxes, stake sales', spending: 'Grants, salaries, buybacks'
    },
    cityIncome: {
      profitTax: 'Profit tax', fines: 'Fines', cityTaxes: 'City taxes',
      dividends: 'Share of company profits', stakeSales: 'Stake sales'
    },
    citySpending: { grants: 'Grants', civilSalaries: 'Government salaries', stakeBuybacks: 'Stake buybacks' },
    net: 'Net',
    balance: 'Balance',
    balanceTitle: 'City balance',
    ownership: 'Owners',
    teamOwners: 'Teams',
    holders: 'Team stakes',
    noHolders: 'No team owns a stake yet.',
    instTotals: 'Income {income} · paid to owners {payout}',
    writeOffsTotal: 'unpaid loans written off {amount}',
    loansNow: 'loans outstanding {amount}',
    lossCf: 'losses to cover before paying owners {amount}',
    income: 'Income', profitInst: 'Profit', writeOffs: 'Written off', payout: 'Paid to owners',
    loans: 'Loans outstanding',
    noPayout: 'No profit paid out this month',
    payoutChart: '{name}: profit paid to its owners by month',
    payoutChartShort: 'Profit paid to owners',
    ratingTitle: '{league} league rating',
    ratingFull: 'Full rating',
    joinAt: 'Teams sign in at',
    code: 'Game code',
    open: 'Open scoreboard',
    fullscreen: 'Full screen',
    rotate: 'Rotate views every 20 seconds',
    decisionsOpen: 'decisions open'
  },

  money: {
    title: 'Where the money went',
    lead: 'All the money guests paid in this game and where it ended up. Hover or tap a flow for details.',
    guests: 'Guests', restaurants: 'Restaurants', losses: 'Capital & loans',
    suppliers: 'Food & supplies', staff: 'Staff', advertising: 'Advertising', quality: 'Quality',
    landlord: 'Landlord', insurer: 'Insurance company', utility: 'Utilities', bank: 'Bank (interest)',
    cityTax: 'City (profit tax)', kept: 'Kept by restaurants',
    ofGuests: 'of guests\' money',
    groupCost: 'Restaurant costs', groupInstitutions: 'Landlord, insurer, utilities, bank',
    groupCity: 'City', groupKept: 'Restaurants\' profit', groupLosses: 'Losses paid from capital and loans',
    flow: 'Flow', amount: 'Amount', share: 'Share',
    ownersTitle: 'Who got the companies\' profits',
    ownersLead: 'The landlord, bank, insurer and utilities took in {amount} from restaurants. Their profit goes to their owners.',
    city: 'City', players: 'Team owners', private: 'Private owners',
    retained: 'Covered losses and unpaid loans',
    cityGot: 'The city collected profit tax {tax}, fines and city taxes {fines}, stake sales {stakes}.',
    cityPaid: 'The city paid grants {grants}, government salaries {salaries}, stake buybacks {buybacks}.',
    betweenTeams: 'Teams sent each other {amount}.',
    empty: 'The money map appears after the first month.'
  },

  rating: {
    title: 'Rating',
    lead: 'All rated games of the league. Score = 0.7 × average capital multiplier + 0.9 × average place score.',
    howTitle: 'How the rating works',
    how1: 'Capital multiplier = money at the end of the game ÷ starting capital.',
    how2: 'Place score is 1 for first place, 0 for last, in between for the rest.',
    how3: 'A game counts when it is played to the last month of its league and isn\'t a practice game.',
    how4: 'A team counts in a game when it played at least three quarters of the months: 9 of 12, 18 of 24, 27 of 36.',
    leagueLabel: 'League',
    months: '{n} months',
    filter: 'Where',
    all: 'Everywhere',
    multistate: 'Across the U.S.',
    international: 'International',
    gamesList: '{n} games',
    gameLine: 'place {place} of {rivals}, {capital}, ×{mult}',
    columns: { team: 'Team', where: 'Where', games: 'Games', wins: 'Wins', mult: 'Avg ×', place: 'Place score', share: 'Avg share', score: 'Score' },
    empty: 'No rated games in this league yet.'
  },

  host: {
    console: 'Host console',
    run: 'Run', teams: 'Teams', cityTab: 'City', settings: 'Settings',
    boardLink: 'Projector scoreboard',
    copyBoardLink: 'Copy link',
    signInHint: 'Teams sign in at {site} with the email you added and a 6-digit code from their inbox.',
    notStartedTitle: 'Ready to start',
    monthOpen: 'Month {n} is open',
    monthDone: 'Month {n} of {total} is calculated',
    gameOver: 'The game is over',
    openMonth: 'Open month {n}',
    opened: 'Month {n} is open. The timer is running.',
    monthLength: '{minutes} min per month',
    calcMonth: 'Calculate month {n}',
    calculated: 'Month {n} is calculated.',
    confirmCalc: 'Calculate month {n} now? {waiting} team(s) haven\'t sent a decision — their last one will repeat.',
    submitted: '{n} of {total} teams sent a decision',
    addTeamsFirst: 'Add the teams\' emails first — see the Teams tab.',
    profilesPending: '{n} team(s) haven\'t filled in their name and restaurant yet. They can do it while month 1 is open.',
    finish: 'Finish game & update rating',
    finishEarly: 'Finish the game now? It ends before month {total}, so it won\'t count in the rating.',
    finishConfirm: 'Finish the game and update the rating?',
    finishedRated: 'The game is finished and counts in the rating.',
    finishedUnrated: 'The game is finished. It doesn\'t count in the rating.',
    openReport: 'Open the report',
    playAgain: 'Play again with the same teams',
    playAgainConfirm: 'Create a new game with the same teams and settings?',
    created: 'Game created. Code {code}.',
    rosterTitle: 'Teams',
    rosterLead: 'One team — one email. Paste the list: new lines, commas or spaces all work. The list is the full roster: emails you remove leave the game, unless the team has already played.',
    rosterEmails: 'Team emails',
    rosterSave: 'Save roster',
    rosterResult: 'Roster saved: {added} added, {removed} removed.',
    rosterNotes: 'Not changed:',
    teamsTitle: 'Teams in the game ({n})',
    noTeams: 'No teams yet.',
    viewAs: 'Play as',
    viewAsLead: '“Play as” opens a team\'s own screen: see what they see, or play for them in a practice run.',
    profilePending: 'Profile not filled in yet',
    columns: { team: 'Team', money: 'Cash / savings', brand: 'Brand', capacity: 'Capacity', loan: 'Loan', sent: 'Sent' },
    cityLead: 'You play the city. Fines, taxes and stake sales go to the city budget; grants, government salaries and buybacks come out of it.',
    lastMonthNet: 'Last month, net',
    adjustTitle: 'Fine or grant one team',
    amount: 'Amount, $', reason: 'Reason', reasonPlaceholder: 'Shown to the team',
    fine: 'Fine', grant: 'Grant', fined: 'Fine applied.', granted: 'Grant paid.',
    pickTeam: 'Pick a team.',
    massTitle: 'Everyone at once',
    massHint: 'Per team.',
    taxAll: 'Tax every open restaurant', grantAll: 'Grant everyone out of business',
    confirmTaxAll: 'Tax every open restaurant {amount}?',
    confirmGrantAll: 'Give {amount} to every team out of business?',
    massDone: 'Done: {n} team(s), {total} in total.',
    sharesTitle: 'City ownership',
    sharesLead: 'How much of each company the city owns. The rest belongs to teams (stakes) and private owners. The city gets its share of each company\'s profit every month.',
    cityPct: 'City owns, %',
    cityShareSaved: 'The city now owns {pct} of the {name}.',
    stakesTitle: 'Stakes',
    stakesLead: 'Sell part of the city\'s share to a team, buy it back, or record a deal between teams. The team pays or gets the price at once; dividends follow every month.',
    sell: 'City sells', buyback: 'City buys back', deal: 'Deal between teams',
    company: 'Company', buyer: 'Buyer', seller: 'Seller', holder: 'From team',
    pct: 'Share, %', price: 'Price, $',
    stakeHint: 'Over the last months each 1% paid about {perPct} a year. {left} month(s) left: {pct} would pay about {est} by the end.',
    cityOwns: 'The city owns {pct}.',
    stakeSubmit: 'Record',
    stakeDone: 'Stake recorded.',
    confirmStake: {
      sell: 'Sell {pct} of the {name} to {buyer} for {price}?',
      buyback: 'Buy back {pct} of the {name} from {seller} for {price}?',
      deal: '{seller} sells {pct} of the {name} to {buyer} for {price}?'
    },
    gameInfo: 'Game details',
    title: 'Game title', titlePlaceholder: 'e.g. Austin Chamber, fall session',
    organizer: 'Organizer', organizerPlaceholder: 'e.g. Austin Chamber of Commerce',
    scheduled: 'Date and time', scheduledHint: 'In the game\'s time zone.',
    timezone: 'Time zone',
    openBook: 'After the final, show every team\'s decisions to all players',
    practiceLabel: 'Practice game — doesn\'t count in the rating',
    practiceLocked: 'Can\'t change after month 1.',
    league: 'League',
    leagueFixed: '{league} league · {total} months. The league is set when the game is created.',
    sponsorTitle: 'Sponsor (optional)',
    sponsorLead: 'Shown as a clearly marked ad on the scoreboard. The sponsor doesn\'t take part in the game.',
    sponsorName: 'Sponsor name', sponsorLogo: 'Logo URL (https://…)', sponsorUrl: 'Website (https://…)',
    saved: 'Saved.',
    economy: 'Economy',
    settingsLead: 'Changes apply from the next month, so teams decide with the numbers they will be judged by.',
    allowed: 'Allowed {range}',
    configSave: 'Save for next month',
    configSaved: 'Saved. Applies from the next month.',
    badNumber: 'Check the number for “{name}”.',
    nothingChanged: 'Nothing changed.',
    dangerTitle: 'Delete the game',
    deleteLead: 'Only a game with no calculated months can be deleted.',
    delete: 'Delete game',
    deleteConfirm: 'Delete this game for good?',
    deleted: 'Game deleted.',
    createTitle: 'Create a game',
    createLead: 'After this you\'ll add the teams\' emails and open month 1.',
    create: 'Create game'
  },

  admin: {
    title: 'Hosts',
    lead: 'Hosts create and run games. Admins come from the project settings (ADMIN_EMAILS).',
    add: 'Add a host', email: 'Host email', addHint: 'They sign in with this email and a code — no password.',
    added: '{email} is now a host.', remove: 'Remove', removed: '{email} is no longer a host.',
    removeConfirm: 'Remove {email} from hosts? Their games stay.',
    admins: 'Admins', adminsNote: 'Admins can run every game and assign hosts.',
    hosts: 'Hosts', none: 'No hosts yet.'
  },

  history: {
    title: 'Game report',
    running: 'The game is still running — this report updates as months are calculated.',
    summary: 'Your result',
    place: 'Place',
    noMonths: 'No months played yet.',
    stakesHeld: 'Stakes you hold',
    csv: 'Download CSV',
    csvAll: 'Download CSV (all teams)',
    shareLink: 'Copy report link for teammates',
    linkCopied: 'Link copied — anyone with it can view this report.',
    months: 'Month by month',
    monthDetails: 'Month details',
    served: 'Served',
    cashEnd: 'Cash at end',
    savingsMark: '(savings)',
    decisions: 'Your decisions',
    auto: '(repeated)',
    autoNote: '“Repeated” means the team didn\'t send a decision and the last one was used.',
    shifts: 'Shifts',
    qualityInvest: 'Quality',
    allDecisions: 'Every team\'s decisions',
    allDecisionsLead: 'Open after the final so teams can go through the game together.',
    decisionsCount: '{n} months',
    hidden: 'Other teams\' decisions open after the final.',
    closedBook: 'The host kept other teams\' decisions private.',
    log: 'Money log',
    what: 'What', amount: 'Amount', note: 'Note',
    kinds: {
      start_capital: 'Starting capital', month_cash_flow: 'Month result', loan_out: 'Loan received',
      loan_repay: 'Loan repaid', transfer_in: 'Transfer received', transfer_out: 'Transfer sent',
      civil_salary: 'Government salary', employer_salary: 'Salary', settlement: 'Business closed',
      bankruptcy: 'Bankruptcy', reopen: 'New restaurant', fine: 'City fine', grant: 'City grant',
      city_tax: 'City tax', dividend: 'Dividends', stake_buy: 'Stake bought', stake_sell: 'Stake sold'
    }
  },

  guide: {
    title: 'Guide',
    print: 'Print',
    contents: 'Contents',
    lead: 'All numbers are this game\'s current rules. If the host changes a rule, the guide updates when the change takes effect.',
    costs: {
      item: 'Cost', amount: 'Amount', who: 'Paid to',
      perMeal: '{cogs} a meal (+{qadd} per quality point)', suppliers: 'Suppliers', staff: 'Your staff',
      fixed: 'Fixed costs', perShift: '{cost} per extra shift', perPoint: '{upkeep} per quality point',
      yourCall: 'Advertising and quality investment', decide: 'what you decide'
    },
    channels: {
      seo: ['Slow start: pay something {seoRamp} months in a row and only then it switches on. After that it holds with small top-ups (fades {seoDecay} a month). Typical budget {seoRef}.'],
      promo: ['Works only in the month you pay for. Nothing builds up — stop paying and it\'s gone. Typical budget {promoRef}.'],
      maps: ['Kicks in the month **after** you pay, then builds up and fades slowly ({mapsDecay} a month). Typical budget {mapsRef}.'],
      social: ['Works right away, but people forget it fastest: {socialDecay} of the effect is gone each month. Post regularly — a one-off is nearly useless. Typical budget {socialRef}.'],
      outdoor: ['One placement of at least {outdoorMin} works for exactly {outdoorMonths} months, then stops at once. Pay again to renew. Typical budget {outdoorRef}.'],
      affiliate: ['Brings no new guests. While you pay at least {affiliateMin} a month, the guests you serve spend {affiliateBonus} more. Paying more than the minimum adds nothing.']
    },
    s: {
      goal: {
        title: 'How to win',
        body: [
          'You run a restaurant. The other teams run restaurants in the same town and compete for the same guests. Every month you set your price, advertising, staff and quality; the host calculates the month, and everyone sees the results on the scoreboard.',
          'The winner is the team with the most **money** at the end — not revenue, not market share. Your result is your capital multiplier: money at the end ÷ your starting capital of {startCapital}.',
          'This game: {league} league, {total} months, about {minutes} minutes per month.'
        ],
        practice: 'This is a practice game: it doesn\'t count in the rating.'
      },
      month: {
        title: 'How a month goes',
        body: [
          '- The host opens the month. The timer at the top shows how long you have.',
          '- Send your decision. You can change it until the timer runs out.',
          '- The host calculates the month. Results, news and the scoreboard update on every screen.',
          '- Missed the timer? Your last decision repeats, trimmed to the cash you have. Silence is a move too — usually a bad one.',
          'Between months: talk to other teams, borrow or repay, send money and make deals.'
        ]
      },
      pnl: {
        title: 'Your month in two lines',
        body: [
          '= revenue − food & supplies − rent − insurance − utilities − payroll − shifts, quality, advertising − loan interest − profit tax = net profit',
          '= net profit − loan principal = change in your cash',
          'Fixed costs come due no matter what: **{fixedTotal} a month**. At the reference price of {pRef} a meal leaves you {margin} after food costs, so you need about **{breakEven} guests a month** just to break even.'
        ]
      },
      market: {
        title: 'The market',
        body: [
          'The town starts with **{marketBase} guests a month**, shared by all restaurants. The market doesn\'t grow with the number of teams: more restaurants means fewer guests each.',
          '- Good food grows the market: **+{gain}** guests for every point of the **average** quality in town. One team invests — everyone gains.',
          '- Low prices bring people out: when the average price is low, the market grows up to ×{catMax}; when it\'s high, it shrinks to as little as ×{catMin}.',
          '- Guests beyond your capacity are turned away — and that hurts your reputation.'
        ]
      },
      choice: {
        title: 'How guests choose',
        body: [
          'Each restaurant gets a slice of the market in proportion to how attractive it is:',
          '= attractiveness = (1 + ½ brand + ½ quality + advertising) × price factor × reputation',
          '= your guests = market × your attractiveness ÷ everyone\'s attractiveness',
          'You serve as many of them as your capacity allows.'
        ]
      },
      price: {
        title: 'Price',
        body: [
          'Reference price **{pRef}**. You can charge from {floor} to {ceiling}.',
          '- Guests watch prices: 10% cheaper makes you about 26% more attractive, 10% dearer about 19% less.',
          '- Above **{softCap}** is the pain point: guests leave sharply, not gradually.',
          '- Every meal costs you {cogs} in food and supplies, more with higher quality. Don\'t price below that.',
          '- A price that feels fair for your quality grows your brand faster.'
        ]
      },
      capacity: {
        title: 'Capacity and shifts',
        body: [
          'You can serve **{capacityBase} guests a month**. Each extra shift adds {step} guests of capacity for {cost} a month.',
          '- Change by one shift a month, from {min} to +{max}.',
          '- Cutting below the base lowers capacity but not payroll.',
          '- More guests than seats? The rest walk away, and your reputation drops.'
        ]
      },
      quality: {
        title: 'Quality',
        body: [
          'A one-time investment: every **{unit}** buys +1 quality point, up to 3.',
          '- Quality fades {decay} a month, and upkeep is {upkeep} a month per point.',
          '- Better food costs more: +{qadd} food cost per point.',
          '- Quality makes you more attractive, helps your brand grow and grows the whole market.'
        ]
      },
      marketing: {
        title: 'Advertising',
        body: [
          'Six channels, each with its own character. Returns shrink: four times the budget gives twice the effect, not four times. Spreading money across channels usually beats pouring it into one.'
        ]
      },
      brand: {
        title: 'Brand and reputation',
        body: [
          '- **Brand** (0–3) grows from happy guests: serve more than your fair share at a fair price. It fades {brandDecay} a month.',
          '- **Reputation** (0.6–1.0) multiplies your attractiveness. Turning guests away lowers it; it recovers slowly by itself.',
          '- **Quality** (0–3) is what you bought with investment.'
        ]
      },
      costs: {
        title: 'Monthly costs',
        body: [
          'Rent goes to the landlord, insurance to the insurance company, utilities to the utility company. See “Landlord, bank, insurer, utilities” below — you can own a piece of them.'
        ]
      },
      tax: {
        title: 'Profit tax',
        body: [
          '**{taxRate}** of your profit goes to the city budget.',
          'Losses carry forward: after a loss you pay no tax until your later profits have covered it.'
        ],
        body0: [
          'There is no profit tax in this game right now. Losses are still tracked, in case the city brings a tax in.'
        ]
      },
      bank: {
        title: 'Bank and loans',
        body: [
          '- Credit opens after your first month: up to **{l1}**.',
          '- Two months in a row of positive cash flow raise the limit to **{l3}** ({l2} after a missed payment). The limit never goes down.',
          '- Interest is {rate} a year ({monthly} a month) on what you owe. The principal is repaid in {term} equal monthly payments; a new loan restarts the schedule.',
          '- Repay early at any time.',
          'The bank in this game is fictional and isn\'t an offer of credit.'
        ]
      },
      cash: {
        title: 'If you run out of cash',
        body: [
          'If your cash is below zero at the end of a month, the restaurant closes. What you still owe the bank is written off — that\'s the bank\'s loss. Then choose what to do:',
          '- **Government job**: {civil} a month from the city budget, paid automatically.',
          '- **Freelance**: live on transfers from other teams. Negotiate.',
          '- **Get hired**: name your trade and offer it to a team for a salary they pay each month.',
          'Back in the game: save **{reopen}** and open a new restaurant from scratch — brand, reputation, quality and ads start at zero, and your savings become the new cash. You can switch between paths at any time; savings stay with you.',
          'You can also close the business on purpose: you keep your cash after paying off the loan.'
        ]
      },
      deals: {
        title: 'Deals and transfers',
        body: [
          'Send money to any team, up to your cash: pay for a service, help an ally, buy a share of their business. The host sees every transfer.'
        ]
      },
      owners: {
        title: 'Landlord, bank, insurer, utilities — and stakes',
        body: [
          'The rent, interest, insurance and utility bills that restaurants pay are income for four companies. Every month each company pays its profit to its owners in proportion to their shares — after covering its own past losses. The bank loses the loans that bankrupt teams never repaid.',
          'The city owns part of every company (the host decides how much); private owners hold the rest. The city can sell part of its share to a team: from then on that team gets its cut of the profit every month as dividends. Buybacks and deals between teams also go through the host.',
          '> Stakes don\'t count in your final capital — only money does. A stake is worth buying if its dividends pay it back before the game ends.',
          'When a team leaves the game, its stakes go back to the city.',
          'A classic play: take a loan, buy a stake in the insurance company, then lobby the city to raise insurance premiums.'
        ]
      },
      city: {
        title: 'The city and the host',
        body: [
          'The host plays the city. The city collects profit tax, fines, city taxes, its share of company profits and money from stake sales. It pays grants, government salaries and stake buybacks. Its budget is on the scoreboard.',
          'Lobbying works: convince the host to change the rules — rent, insurance, utilities, payroll, taxes, the loan rate. Changes apply from the next month and are announced before they do.'
        ]
      },
      board: {
        title: 'The scoreboard',
        body: [
          '- Capital and income are visible for everyone, including teams out of business.',
          '- Market share, guests and brand — only for teams running a restaurant.',
          '- Economy shows the market, the city budget and the four companies; “Where the money went” follows every dollar guests paid.'
        ]
      },
      scoring: {
        title: 'Winning and the rating',
        body: [
          '- **Capital** is your money at the end: cash in the restaurant, or savings if you are out of business.',
          '- **Multiplier** = capital ÷ {startCapital}. **Place** is by capital.',
          '- The league rating adds up all rated games: score = 0.7 × average multiplier + 0.9 × average place score (1 for first place, 0 for last).',
          '- A game is rated when it\'s played to its last month and isn\'t a practice game. A team counts if it played at least three quarters of the months ({minMonths} of {total}).'
        ]
      },
      leagues: {
        title: 'Leagues',
        body: [
          '- **Start** — 12 months — for people about to start a business.',
          '- **Growth** — 24 months — for owners of a running business.',
          '- **Elite** — 36 months — for executives and management teams.'
        ],
        current: 'You are playing in the {league} league.'
      }
    }
  },

  statuses: {
    active: 'Open', bankrupt: 'Bankrupt', civil_service: 'Government job', freelance: 'Freelance',
    custom_employed: 'Hired', left: 'Left', setup: 'Not started', running: 'Running', finished: 'Finished'
  },

  errors: {
    auth_required: 'Please sign in again.',
    not_registered: 'This email isn\'t on any game roster yet. Ask your host to add it.',
    bad_email: 'That doesn\'t look like an email address.',
    not_in_game: 'You are not on this game\'s roster.',
    not_host: 'Only the host can do that.',
    not_admin: 'Only an admin can do that.',
    game_not_found: 'Game not found.',
    player_not_found: 'Team not found.',
    round_closed: 'The month isn\'t open — wait for the host.',
    price_too_low: 'Price must be between {min} and {max}.',
    price_too_high: 'Price must be between {min} and {max}.',
    bad_price: 'Enter a price.',
    insufficient_cash: 'Not enough money: you have {available}.',
    negative_spend: 'Amounts can\'t be negative.',
    shifts_step: 'You can add or cut one shift per month.',
    shifts_out_of_range: 'That\'s outside the allowed number of shifts.',
    no_credit_yet: 'Credit opens after your first month.',
    over_limit: 'That\'s over your credit limit. Available: {available}.',
    no_loan: 'You have no loan to repay.',
    bad_amount: 'Check the amount.',
    bad_params: 'Check the fields.',
    self_transfer: 'You can\'t send money to yourself.',
    recipient_not_found: 'That team isn\'t in the game anymore.',
    not_active: 'Only an open restaurant can do that.',
    invalid_path: 'Choose a path.',
    invalid_state: 'That isn\'t possible right now.',
    empty_profession: 'Name your trade.',
    not_eligible: 'Only teams out of business can open a new restaurant.',
    not_enough_savings: 'You need {needed} in savings to open a new restaurant.',
    not_custom_path: 'Choose “Get hired” first.',
    self_employer: 'You can\'t hire yourself.',
    employer_not_found: 'That team isn\'t in the game.',
    employer_not_active: 'That team\'s restaurant is closed.',
    not_your_employee: 'That person doesn\'t work for you.',
    already_paid: 'Already paid this month.',
    game_finished: 'This game is over.',
    already_open: 'The month is already open.',
    no_open_round: 'There\'s no open month to calculate.',
    no_players: 'Add at least one team first.',
    city_has_less: 'The city owns only {cityPct}% — it can\'t sell more.',
    not_enough_stake: 'That team owns only {has}%.',
    over_100: 'Ownership can\'t exceed 100%. The city can own at most {maxCityPct}%.',
    bad_pct: 'Enter a share between 0 and 100%.',
    bad_institution: 'Pick a company.',
    player_cannot_trade: 'That team can\'t trade stakes now.',
    player_left: 'That team has left the game.',
    round_open: 'Calculate the open month first.',
    game_has_history: 'Games with played months can\'t be deleted.',
    game_started: 'That can\'t change after the game has started.',
    empty_title: 'Give the game a title.',
    bad_league: 'Pick a league.',
    bad_url: 'Links must start with https://',
    bad_timezone: 'Pick a time zone.',
    bad_date: 'Check the date.',
    too_many_teams: 'Up to {max} teams per game.',
    restaurant_taken: 'Another team already uses that restaurant name.',
    bad_state: 'Pick a state.',
    bad_country: 'Enter your country.',
    bad_location: 'Tell us where you do business.',
    empty: 'Fill in every field.',
    bad_code: 'Enter the game code.',
    bad_game: 'Game not found.',
    report_not_found: 'This report link doesn\'t work.',
    duplicate_request: 'Already done.',
    unknown_action: 'Something is out of date — reload the page.',
    rate_limited: 'Too many attempts. Wait a minute and try again.',
    bad_code_otp: 'That code didn\'t work. Check it or send a new one.',
    network: 'No connection to the server. Check the internet and try again.',
    server_error: 'Something went wrong on our side. Try again in a moment.'
  }
};

const DICTS = { en: EN };
let current = EN;

export function setLanguage(lang) { current = DICTS[lang] ?? EN; }

/** Подстановка {x} в строку. */
export function fill(text, vars) {
  if (typeof text !== 'string' || !vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/** t('a.b.c', { x: 1 }) → строка из словаря с подстановкой {x}. */
export function t(path, vars) {
  let v = path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), current);
  if (v === undefined) v = path;
  if (typeof v !== 'string') return v;
  return fill(v, vars);
}

/** Текст ошибки сервера по её коду и подробностям. */
export function errorText(res, fmt) {
  const code = typeof res === 'string' ? res : res?.error;
  const vars = {};
  if (res && typeof res === 'object') {
    for (const [k, v] of Object.entries(res)) {
      vars[k] = typeof v === 'number' && fmt && /available|min|max|needed|totalSpend/.test(k) ? fmt(v) : v;
    }
  }
  const text = t('errors.' + code, vars);
  return text === 'errors.' + code ? t('errors.server_error') : text;
}
