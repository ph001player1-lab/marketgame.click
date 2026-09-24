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
    note: 'The bank in this game is fictional.'
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
    metrics: {
      cash: 'Cash', profit: 'Profit', marketSharePct: 'Market share, %', served: 'Guests served',
      price: 'Price', brand: 'Brand', reputation: 'Reputation', quality: 'Quality',
      capacity: 'Capacity', marketingTotal: 'Advertising', qualityInvest: 'Quality investment',
      tax: 'Profit tax', dividends: 'Dividends'
    },
    views: { teams: 'Teams', economy: 'Economy', money: 'Where the money went', rating: 'Rating', rules: 'Rules' },
    empty: 'No data yet — the scoreboard fills in after the first month.',
    offBusiness: 'out of business',
    market: 'Market: {guests} guests',
    ownership: 'Owners',
    income: 'Income', profitInst: 'Profit', writeOffs: 'Unpaid loans written off', payout: 'Paid to owners',
    loans: 'Loans outstanding', lossCf: 'Losses to cover: {amount}',
    cityTitle: 'City budget', cityBalance: 'Balance: {amount}',
    cityIncome: {
      profitTax: 'Profit tax', fines: 'Fines', cityTaxes: 'City taxes',
      dividends: 'City share of profits', stakeSales: 'Stake sales'
    },
    citySpending: { grants: 'Grants', civilSalaries: 'Government salaries', stakeBuybacks: 'Stake buybacks' },
    byState: 'By location',
    joinAt: 'Teams sign in at',
    code: 'Game code'
  },

  money: {
    title: 'Where the money went',
    lead: 'All the money guests paid, and where it ended up.',
    guests: 'Guests', restaurants: 'Restaurants',
    suppliers: 'Suppliers', staff: 'Staff', advertising: 'Advertising', quality: 'Renovation & chefs',
    landlord: 'Landlord', insurer: 'Insurance', utility: 'Utilities', bank: 'Bank', cityTax: 'City (tax)',
    kept: 'Kept by restaurants', city: 'City', players: 'Team owners', private: 'Private owners',
    empty: 'The map appears after the first month.'
  },

  rating: {
    title: 'Rating',
    lead: 'Across all rated games of a league. Score = 0.7 × capital multiplier + 0.9 × place score.',
    filter: 'Location',
    all: 'Everywhere',
    multistate: 'Across the U.S.',
    international: 'International',
    columns: { team: 'Team', where: 'Where', games: 'Games', wins: 'Wins', mult: 'Avg multiplier', place: 'Place score', share: 'Avg share', score: 'Score' },
    empty: 'No rated games in this league yet.'
  },

  host: {
    console: 'Host console',
    run: 'Run', teams: 'Teams', cityTab: 'City', settings: 'Settings',
    openMonth: 'Open month {n}',
    calcMonth: 'Calculate month {n}',
    confirmCalc: 'Calculate month {n} now? Teams that haven\'t sent a decision will repeat their last one.',
    submitted: '{n} of {total} teams sent decisions',
    boardLink: 'Projector scoreboard',
    code: 'Game code: {code}',
    finish: 'Finish game & update rating',
    finishEarly: 'Finish the game now? It ends before month {total}, so it will not count in the rating.',
    finishConfirm: 'Finish the game and update the rating?',
    finished: 'The game is finished. Rated: {rated}.',
    playAgain: 'Play again with the same teams',
    delete: 'Delete game',
    deleteConfirm: 'Delete this game? Only games with no played months can be deleted.',
    rosterTitle: 'Teams',
    rosterLead: 'Paste the teams\' emails — one team, one email. Commas, spaces or new lines all work. This list is the final roster: removed emails leave the game, unless the team has already played.',
    rosterSave: 'Save roster',
    rosterResult: 'Added {added}, removed {removed}.',
    viewAs: 'Play as',
    profilePending: 'profile not filled yet',
    columns: { team: 'Team', email: 'Email', status: 'Status', money: 'Cash / savings', brand: 'Brand', capacity: 'Capacity', loan: 'Loan', sent: 'Sent' },
    cityLead: 'You play the city. Fines and taxes go to the city budget; grants and government salaries come out of it.',
    adjustTitle: 'Fine or grant one team',
    amount: 'Amount, $', reason: 'Reason',
    fine: 'Fine', grant: 'Grant',
    massTitle: 'Everyone at once',
    taxAll: 'Tax every open restaurant', grantAll: 'Grant everyone out of business',
    sharesTitle: 'City ownership',
    sharesLead: 'How much of each company the city owns. The rest belongs to teams (stakes) and private owners.',
    cityPct: 'City %',
    stakesTitle: 'Stakes',
    sell: 'City sells to a team', buyback: 'City buys back', deal: 'Deal between teams',
    pct: 'Share, %', price: 'Price, $', seller: 'Seller', buyer: 'Buyer',
    hint: 'Reference: about {amount} a year per 1%',
    settingsLead: 'Changes apply from the next month, so teams decide with the numbers they will be judged by.',
    gameInfo: 'Game details',
    title: 'Game title', organizer: 'Organizer (chamber)', sponsorName: 'Sponsor name',
    sponsorLogo: 'Sponsor logo URL (https://…)', sponsorUrl: 'Sponsor website (https://…)',
    timezone: 'Time zone', scheduled: 'Date and time', openBook: 'After the final, show every team\'s decisions to all players',
    practiceLabel: 'Practice game — does not count in the rating',
    league: 'League',
    createTitle: 'Create a game', create: 'Create game',
    economy: 'Economy'
  },

  admin: {
    title: 'Hosts',
    lead: 'Hosts create and run games. Admins are set in the project settings.',
    add: 'Add host', email: 'Host email', remove: 'Remove',
    admins: 'Admins', hosts: 'Hosts', none: 'No hosts yet.'
  },

  history: {
    title: 'Game report',
    summary: 'Your result',
    months: 'Month by month',
    decisions: 'Your decisions',
    allDecisions: 'Every team\'s decisions',
    hidden: 'Other teams\' decisions open after the final.',
    log: 'Money log',
    csv: 'Download CSV',
    shareLink: 'Copy report link for teammates',
    linkCopied: 'Link copied — anyone with it can view this report.'
  },

  guide: {
    title: 'Guide'
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

/** t('a.b.c', { x: 1 }) → строка из словаря с подстановкой {x}. */
export function t(path, vars) {
  let v = path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), current);
  if (v === undefined) v = path;
  if (typeof v !== 'string') return v;
  if (!vars) return v;
  return v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
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
