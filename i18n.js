const LANGS = {
  ru: {
    // Stats bar
    tokens: 'Токены',
    service: 'Сервис',
    lastToken: 'Последний',
    // Status labels
    appBridge: 'Связь с приложением',
    labsSession: 'Сессия Labs',
    account: 'Аккаунт',
    verification: 'Верификация',
    // Status values
    checking: 'Проверка...',
    connected: 'Подключено',
    notRunning: 'Не запущено',
    error: 'Ошибка',
    active: 'Активна',
    noSession: 'Нет сессии',
    authenticated: 'Авторизован',
    notSignedIn: 'Не авторизован',
    unknown: 'Неизвестно',
    ready: 'Готово',
    notReady: 'Не готово',
    checkingDots: 'Проверка…',
    // Buttons
    check: 'Проверить',
    verify: 'Тест',
    refresh: 'Обновить',
    openLabs: 'Открыть Google Labs',
    // Toggle
    autoRefresh: 'Авто-обновление сессии (10 мин)',
    // Results
    verified: 'Проверено',
    chars: 'симв.',
    failed: 'Ошибка',
    noResponse: 'Нет ответа',
    cleared: 'Очищено',
    cookiesRefreshed: 'куки, страница обновлена',
    noLabsTab: 'Нет вкладки Labs',
    // Footer
    footer: 'Сервис аутентификации ShumTube',
    // Time
    secAgo: 'с назад',
    minAgo: 'м назад',
    hourAgo: 'ч назад',
  },
  uz: {
    tokens: 'Tokenlar',
    service: 'Servis',
    lastToken: 'Oxirgi',
    appBridge: 'Ilova bilan aloqa',
    labsSession: 'Labs sessiya',
    account: 'Akkaunt',
    verification: 'Tekshiruv',
    checking: 'Tekshirilmoqda...',
    connected: 'Ulangan',
    notRunning: 'Ishlamayapti',
    error: 'Xatolik',
    active: 'Faol',
    noSession: 'Sessiya yo\'q',
    authenticated: 'Avtorizatsiya qilingan',
    notSignedIn: 'Kirilmagan',
    unknown: 'Noma\'lum',
    ready: 'Tayyor',
    notReady: 'Tayyor emas',
    checkingDots: 'Tekshirilmoqda…',
    check: 'Tekshirish',
    verify: 'Test',
    refresh: 'Yangilash',
    openLabs: 'Google Labs ochish',
    autoRefresh: 'Avtomatik yangilash (10 daq)',
    verified: 'Tasdiqlangan',
    chars: 'belgi',
    failed: 'Xatolik',
    noResponse: 'Javob yo\'q',
    cleared: 'Tozalandi',
    cookiesRefreshed: 'cookie, sahifa yangilandi',
    noLabsTab: 'Labs oynasi yo\'q',
    footer: 'ShumTube autentifikatsiya xizmati',
    secAgo: 's oldin',
    minAgo: 'd oldin',
    hourAgo: 's oldin',
  },
  en: {
    tokens: 'Tokens',
    service: 'Service',
    lastToken: 'Last Token',
    appBridge: 'App Bridge',
    labsSession: 'Labs Session',
    account: 'Account',
    verification: 'Verification',
    checking: 'Checking...',
    connected: 'Connected',
    notRunning: 'Not running',
    error: 'Error',
    active: 'Active',
    noSession: 'No session',
    authenticated: 'Authenticated',
    notSignedIn: 'Not signed in',
    unknown: 'Unknown',
    ready: 'Ready',
    notReady: 'Not ready',
    checkingDots: 'Checking…',
    check: 'Check',
    verify: 'Verify',
    refresh: 'Refresh',
    openLabs: 'Open Google Labs',
    autoRefresh: 'Auto-refresh session (10 min)',
    verified: 'Verified',
    chars: 'chars',
    failed: 'Failed',
    noResponse: 'No response',
    cleared: 'Cleared',
    cookiesRefreshed: 'cookies & refreshed',
    noLabsTab: 'No Labs tab open',
    footer: 'ShumTube authentication service',
    secAgo: 's ago',
    minAgo: 'm ago',
    hourAgo: 'h ago',
  },
};

let _currentLang = 'ru';

function setLang(lang) {
  _currentLang = lang;
  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ shumtubeLang: lang });
    }
  } catch (e) {}
}

function getLang() {
  return _currentLang;
}

function t(key) {
  return (LANGS[_currentLang] && LANGS[_currentLang][key]) || LANGS.en[key] || key;
}

function initLang(callback) {
  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['shumtubeLang'], (data) => {
        if (data.shumtubeLang && LANGS[data.shumtubeLang]) {
          _currentLang = data.shumtubeLang;
        }
        if (callback) callback(_currentLang);
      });
      return;
    }
  } catch (e) {}
  if (callback) callback(_currentLang);
}
