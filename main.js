const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const { loadSettings, saveSettings } = require('./settings');

let mainWindow;
let settingsWindow;
let tray = null;
let isQuitting = false;
let currentSettings = loadSettings();

function createWindow() {
  // Загружаем настройки для размера окна
  currentSettings = loadSettings();
  const windowWidth = currentSettings.windowWidth || 1200;
  const windowHeight = currentSettings.windowHeight || 800;
  const startMinimized = currentSettings.startMinimized || false;
  
  // Загружаем иконку через nativeImage для правильной работы на Linux
  const iconPath = path.join(__dirname, 'icon.png');
  let appIcon = null;
  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      // Создаем иконку нужного размера для Linux (256x256 обычно оптимально)
      appIcon = icon.resize({ width: 256, height: 256 });
    }
  } catch(e) {
    console.error('Ошибка загрузки иконки:', e);
  }
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: currentSettings.darkMode ? '#1a1a1a' : '#ffffff',
    titleBarStyle: 'default',
    icon: appIcon || iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true, // Включаем для работы капчи
      allowRunningInsecureContent: false,
      backgroundThrottling: false, // Отключаем throttling для фоновых вкладок
      plugins: true, // Разрешаем плагины для капчи
      sandbox: false, // Отключаем sandbox для лучшей совместимости
      spellcheck: false, // Отключаем проверку орфографии для производительности
      enableWebSQL: false, // Отключаем WebSQL (устаревший)
      v8CacheOptions: 'code', // Включаем кэширование V8
      disableDialogs: false
    },
    show: !startMinimized // Показываем окно в зависимости от настройки
  });
  
  // Сохраняем размер окна при изменении
  mainWindow.on('resized', () => {
    const [width, height] = mainWindow.getSize();
    currentSettings.windowWidth = width;
    currentSettings.windowHeight = height;
    saveSettings(currentSettings);
  });
  
  // Применяем zoom level
  if (currentSettings.zoomLevel) {
    mainWindow.webContents.setZoomFactor(currentSettings.zoomLevel);
  }
  
  // Устанавливаем иконку после создания окна (для Linux)
  if (appIcon) {
    mainWindow.setIcon(appIcon);
  }
  
  // Показываем окно если не минимизировано
  if (!startMinimized) {
      mainWindow.show();
  }

  // Обработка ошибок загрузки (игнорируем некритичные ошибки)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Игнорируем некритичные коды ошибок
    if (errorCode === -3 || errorCode === -106 || errorCode === -105) { // ERR_ABORTED, ERR_INTERNET_DISCONNECTED, ERR_NETWORK_CHANGED
      return;
    }
    console.error('Ошибка загрузки:', errorCode, errorDescription, validatedURL);
    if (errorCode !== -3) {
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="padding: 20px; font-family: sans-serif;"><h1>Ошибка загрузки</h1><p>Не удалось загрузить страницу Perplexity.</p><p>Код ошибки: ${errorCode}</p><p>${errorDescription}</p><button onclick="location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Перезагрузить</button></div>';
      `);
    }
  });
  
  // Подавляем некритичные ошибки консоли
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Игнорируем некритичные ошибки GL и connection
    if (message.includes('gl_surface_presentation_helper') || 
        message.includes('connection.cc') ||
        message.includes('service_worker_storage') ||
        message.includes('GetVSyncParametersIfAvailable')) {
      return; // Не выводим эти ошибки
    }
  });

  // Устанавливаем User-Agent перед загрузкой (более реалистичный для капчи)
  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  mainWindow.webContents.setUserAgent(userAgent);
  
  // Устанавливаем дополнительные заголовки для лучшей совместимости
  const session = mainWindow.webContents.session;
  session.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = userAgent;
    details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
    callback({ requestHeaders: details.requestHeaders });
  });
  
  // Разрешаем загрузку iframe для капчи
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    webContents.setUserAgent(userAgent);
  });

  // Загружаем официальный сайт Perplexity
  mainWindow.loadURL('https://www.perplexity.ai').catch(err => {
    console.error('Ошибка при загрузке URL:', err);
  });

  // Применяем модификации сразу при готовности DOM и после полной загрузки
  let modificationInterval = null;
  
  // Применяем модификации при готовности DOM (без задержки)
  mainWindow.webContents.on('dom-ready', () => {
    const currentURL = mainWindow.webContents.getURL();
    
    if (!currentURL || currentURL.startsWith('about:') || currentURL.startsWith('data:')) {
      return;
    }
    
    if (!currentURL.includes('perplexity.ai')) {
      return;
    }
    
    // Применяем модификации сразу
    applyModifications();
  });
  
  // Также применяем после полной загрузки
  mainWindow.webContents.on('did-finish-load', () => {
    const currentURL = mainWindow.webContents.getURL();
    
    // Проверяем что страница загрузилась (не about:blank или data:)
    if (!currentURL || currentURL.startsWith('about:') || currentURL.startsWith('data:')) {
      return;
    }
    
    if (!currentURL.includes('perplexity.ai')) {
      return;
    }
    
    // Очищаем предыдущий интервал если есть
    if (modificationInterval) {
      clearInterval(modificationInterval);
    }
    
    // Применяем модификации сразу после загрузки
    applyModifications();
    
    // Применяем модификации периодически для борьбы с динамическим контентом
    modificationInterval = setInterval(() => {
      try {
        const url = mainWindow.webContents.getURL();
        if (url.includes('perplexity.ai')) {
          applyModifications();
        } else {
          clearInterval(modificationInterval);
          modificationInterval = null;
        }
      } catch(e) {
        clearInterval(modificationInterval);
        modificationInterval = null;
      }
    }, 5000); // Каждые 5 секунд (реже для производительности)
  });
  
  // Очищаем интервал при закрытии окна
  mainWindow.on('closed', () => {
    try {
      if (modificationInterval) {
        clearInterval(modificationInterval);
        modificationInterval = null;
      }
    } catch(e) {}
  });

  // Функция применения модификаций
  function applyModifications() {
    const currentURL = mainWindow.webContents.getURL();
    if (!currentURL || !currentURL.includes('perplexity.ai')) {
      return;
    }
    
    // Не применяем модификации на страницах капчи
    if (currentURL.includes('recaptcha') || currentURL.includes('challenge') || 
        currentURL.includes('captcha') || currentURL.includes('verify')) {
      return;
    }
    
    // Используем уже загруженные настройки (не перезагружаем каждый раз)
    // currentSettings уже загружены при создании окна
    
    // Если все модификации отключены, не применяем ничего
    if (currentSettings.disableAll) {
      return;
    }
    
    if (!currentSettings.hideSidebar && !currentSettings.hideBanner && 
        !currentSettings.replaceText && !currentSettings.hideNavigation && 
        !currentSettings.blockAds && !currentSettings.customCSS) {
      return;
    }
    
    // Формируем CSS на основе настроек
    let css = '';
    
    if (currentSettings.hideSidebar) {
      css += `
      /* Скрываем sidebar - только настоящий sidebar */
      aside[class*="sidebar"]:not([class*="main"]):not([class*="content"]),
      nav[class*="sidebar"]:not([class*="main"]):not([class*="content"]),
      div[class*="Sidebar"]:not([class*="main"]):not([class*="content"]):not([class*="Main"]),
      [data-testid*="sidebar"]:not([data-testid*="main"]),
      [aria-label*="sidebar" i]:not([aria-label*="main" i]) {
        display: none !important;
      }
      `;
    }
    
    if (currentSettings.hideNavigation) {
      css += `
      /* Скрываем элементы навигации - только ссылки навигации */
      a[href*="/home"]:not([href*="/homepage"]),
      a[href*="/discover"],
      button[aria-label*="menu" i]:not([aria-label*="main" i]),
      nav a[href*="/home"],
      nav a[href*="/discover"] {
        display: none !important;
      }
      `;
    }
    
    if (currentSettings.hideSidebar) {
      css += `
      /* Расширяем основной контент только если скрыт sidebar - очень аккуратно */
      main:not([class*="sidebar"]):not([class*="nav"]),
      [role="main"]:not([class*="sidebar"]):not([class*="nav"]),
      [class*="main-content"]:not([class*="sidebar"]):not([class*="nav"]),
      [class*="MainContent"]:not([class*="Sidebar"]):not([class*="Nav"]) {
        margin-left: 0 !important;
        padding-left: 0 !important;
        max-width: 100% !important;
      }
      /* Убеждаемся что основной контент виден */
      main,
      [role="main"],
      [class*="main-content"],
      [class*="MainContent"],
      [class*="chat"],
      [class*="Chat"],
      [class*="message"],
      [class*="Message"] {
        display: block !important;
        visibility: visible !important;
      }
      `;
    }
    
    if (currentSettings.hideBanner || currentSettings.blockAds) {
      css += `
      /* Скрываем плашку Comet Assistant - только конкретные элементы, не основной контент */
      [class*="comet" i]:not([class*="main"]):not([class*="content"]):not([class*="message"]):not([class*="chat"]),
      [class*="Comet"]:not([class*="Main"]):not([class*="Content"]):not([class*="Message"]),
      [id*="comet" i]:not([id*="main"]):not([id*="content"]):not([id*="message"]),
      [id*="Comet"]:not([id*="Main"]):not([id*="Content"]),
      [class*="banner" i]:not([class*="main"]):not([class*="content"]):not([class*="message"]),
      [class*="Banner"]:not([class*="Main"]):not([class*="Content"]),
      [class*="promo" i]:not([class*="main"]):not([class*="content"]):not([class*="promote"]),
      [class*="Promo"]:not([class*="Main"]):not([class*="Content"]),
      [data-testid*="banner" i]:not([data-testid*="main"]):not([data-testid*="content"]),
      [data-testid*="promo" i]:not([data-testid*="main"]):not([data-testid*="content"]),
      [aria-label*="comet" i]:not([aria-label*="main" i]):not([aria-label*="content" i]),
      [aria-label*="assistant" i]:not([aria-label*="main" i]):not([aria-label*="content" i]):not([aria-label*="chat" i]) {
        display: none !important;
      }
      `;
    }
    
    if (currentSettings.blockAds) {
      css += `
      /* Блокировка рекламы - очень точные селекторы, чтобы не скрыть контент */
      [class*="ad-container" i]:not([class*="add"]):not([class*="advance"]):not([class*="adapter"]):not([class*="main"]):not([class*="content"]):not([class*="message"]),
      [class*="ad-wrapper" i]:not([class*="main"]):not([class*="content"]):not([class*="message"]),
      [id*="ad-container" i]:not([id*="add"]):not([id*="main"]):not([id*="content"]):not([id*="message"]),
      [class*="advertisement" i]:not([class*="main"]):not([class*="content"]):not([class*="message"]),
      [class*="sponsor-banner" i]:not([class*="sponsor-content"]):not([class*="main"]):not([class*="content"]),
      iframe[src*="doubleclick"]:not([src*="main"]):not([src*="content"]),
      iframe[src*="googlesyndication"]:not([src*="main"]):not([src*="content"]) {
        display: none !important;
      }
      `;
    }
    
    // Применяем кастомный CSS если есть
    if (currentSettings.customCSS && currentSettings.customCSS.trim()) {
      css += '\n' + currentSettings.customCSS;
    }
    
    // Применяем темную тему если включена (очень мягко, не перезаписываем стили сайта)
    if (currentSettings.darkMode) {
      // Не применяем темную тему через CSS, чтобы не конфликтовать со стилями сайта
      // Темная тема применяется только к фону окна
    }
    
    // Всегда добавляем защиту основного контента
    css += `
    /* Защита основного контента - гарантируем его видимость */
    main:not([data-perlient-hidden]),
    [role="main"]:not([data-perlient-hidden]),
    [class*="main-content"]:not([data-perlient-hidden]):not([class*="sidebar"]),
    [class*="MainContent"]:not([data-perlient-hidden]):not([class*="Sidebar"]),
    [class*="chat"]:not([data-perlient-hidden]),
    [class*="Chat"]:not([data-perlient-hidden]),
    [class*="message"]:not([data-perlient-hidden]),
    [class*="Message"]:not([data-perlient-hidden]),
    [class*="conversation"]:not([data-perlient-hidden]),
    [class*="Conversation"]:not([data-perlient-hidden]) {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    `;
    
    if (css) {
      // Применяем CSS каждый раз (insertCSS можно вызывать многократно)
      mainWindow.webContents.insertCSS(css).catch(() => {});
    }

    // Изменяем заголовок страницы и название в интерфейсе
    let jsCode = `
    (function() {
        try {
          // Изменяем title страницы
          if (document && document.title) {
            document.title = 'Perlient';
          }
        } catch(e) {
          console.error('Perlient: ошибка изменения title', e);
        }
      })();
    `;
    
    if (currentSettings.replaceText) {
      jsCode += `
      (function() {
        try {
          if (!document || !document.body) return;
          
          // Ищем и заменяем текст "Perplexity" на "Perlient" в видимых элементах
          const replaceText = (node) => {
            try {
              if (!node) return;
              if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent && node.textContent.includes('Perplexity')) {
                  node.textContent = node.textContent.replace(/Perplexity/gi, 'Perlient');
                }
              } else if (node.childNodes) {
                node.childNodes.forEach(replaceText);
              }
            } catch(e) {}
          };
          
          // Заменяем текст при загрузке
          if (document.body) {
            replaceText(document.body);
          }
          
          // Используем MutationObserver для динамического контента
          if (window.MutationObserver && document.body) {
            const observer = new MutationObserver((mutations) => {
              try {
                mutations.forEach((mutation) => {
                  if (mutation.addedNodes) {
                    mutation.addedNodes.forEach((node) => {
                      if (node && node.nodeType === Node.ELEMENT_NODE) {
                        replaceText(node);
                      }
                    });
                  }
                });
              } catch(e) {}
            });
            
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });
          }
        } catch(e) {
          console.error('Perlient: ошибка замены текста', e);
        }
      })();
      `;
    }
    
    if (currentSettings.hideSidebar) {
      jsCode += `
      (function() {
        try {
          if (!document || window.perlientSidebarHidden) return;
          window.perlientSidebarHidden = true;
          
          const hideSidebar = () => {
            try {
              if (!document || !document.body) return;
              
              // Более точные селекторы - только настоящий sidebar
              const sidebarSelectors = [
                'aside[class*="sidebar"]',
                'nav[class*="sidebar"]',
                '[class*="Sidebar"]:not([class*="Main"])',
                '[data-testid*="sidebar"]'
              ];
              
              sidebarSelectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
                  if (elements) {
            elements.forEach(el => {
                      try {
                        if (el.getAttribute('data-perlient-hidden') === 'true') return;
                        // Проверяем, что это действительно sidebar
                        const text = el.textContent || '';
                        const classes = el.className || '';
                        const isMainContent = classes.includes('main') || classes.includes('content') || 
                                            el.closest('[class*="main"]') || el.closest('[class*="content"]');
                        
                        // Скрываем только если это sidebar с навигацией и не основной контент
                        if (!isMainContent && (text.includes('Home') || text.includes('Discover') || 
                            text.includes('Settings') || classes.includes('sidebar') || 
                            classes.includes('Sidebar'))) {
                          el.style.cssText = 'display: none !important; visibility: hidden !important;';
                          el.setAttribute('data-perlient-hidden', 'true');
                        }
                      } catch(e) {}
                    });
                  }
                } catch(e) {}
              });
            } catch(e) {}
          };
          
          if (document.body) {
            hideSidebar();
            setInterval(hideSidebar, 1000);
            
            // Также отслеживаем изменения DOM
            if (window.MutationObserver) {
              const sidebarObserver = new MutationObserver(() => {
                try {
                  hideSidebar();
                } catch(e) {}
              });
              
              sidebarObserver.observe(document.body, {
                childList: true,
                subtree: true
              });
            }
          }
        } catch(e) {
          console.error('Perlient: ошибка скрытия sidebar', e);
        }
      })();
      `;
    }
    
    if (currentSettings.hideBanner) {
      jsCode += `
      (function() {
        try {
          if (!document || window.perlientBannerHidden) return;
          window.perlientBannerHidden = true;
          
          const hideCometBanner = () => {
            try {
              if (!document || !document.body) return;
              
              const allElements = document.querySelectorAll('*');
              if (!allElements) return;
              
              allElements.forEach(el => {
                try {
                  if (el.getAttribute('data-perlient-hidden') === 'true') return;
                  
                  // Пропускаем основной контент
                  const classes = el.className || '';
                  const isMainContent = classes.includes('main') || classes.includes('content') || 
                                      classes.includes('message') || classes.includes('chat') ||
                                      classes.includes('conversation') || el.closest('[class*="main"]') ||
                                      el.closest('[class*="content"]') || el.closest('[class*="chat"]');
                  
                  if (isMainContent) return;
                  
                  const text = el.textContent || '';
                  if (text.includes('Get Ai Power') || 
                      text.includes('Comet Assistent') || 
                      text.includes('Comet Assistant') ||
                      (text.includes('browser with') && text.includes('Comet')) ||
                      (text.includes('Get') && text.includes('Power') && text.includes('browser'))) {
                    // Ищем родительский контейнер плашки
                    let parent = el;
                    for (let i = 0; i < 10 && parent; i++) {
                      try {
                        const parentClasses = parent.className || '';
                        const isParentMain = parentClasses.includes('main') || parentClasses.includes('content') ||
                                           parentClasses.includes('message') || parentClasses.includes('chat');
                        if (isParentMain) break;
                        
                        if (parent.tagName === 'DIV' || parent.tagName === 'SECTION' || 
                            parent.tagName === 'ASIDE' || parent.tagName === 'HEADER' ||
                            parent.tagName === 'ARTICLE' || parent.tagName === 'FOOTER') {
                          parent.style.cssText = 'display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important;';
                          parent.setAttribute('data-perlient-hidden', 'true');
                  }
                  parent = parent.parentElement;
                      } catch(e) {
                        break;
                      }
                    }
                    el.style.cssText = 'display: none !important; visibility: hidden !important;';
                    el.setAttribute('data-perlient-hidden', 'true');
                  }
                } catch(e) {}
              });
            } catch(e) {}
          };
          
          if (document.body) {
            hideCometBanner();
            setInterval(hideCometBanner, 1000);
            
            // Также отслеживаем изменения DOM
            if (window.MutationObserver) {
              const bannerObserver = new MutationObserver(() => {
                try {
                  hideCometBanner();
                } catch(e) {}
              });
              
              bannerObserver.observe(document.body, {
                childList: true,
                subtree: true
              });
            }
          }
        } catch(e) {
          console.error('Perlient: ошибка скрытия баннера', e);
        }
      })();
      `;
    }
    
    // Выполняем JavaScript только если есть код (без задержки)
    if (jsCode.trim().length > 0) {
      mainWindow.webContents.executeJavaScript(jsCode).catch(err => {
        // Игнорируем ошибки выполнения, чтобы не засорять консоль
      });
    }
    
    // Применяем CSS повторно для гарантии (без задержки)
    if (currentSettings.hideSidebar) {
      const url = mainWindow.webContents.getURL();
      if (url.includes('perplexity.ai')) {
        mainWindow.webContents.insertCSS(`
          nav[class*="sidebar"],
          aside[class*="sidebar"],
          div[class*="sidebar"],
          [class*="Sidebar"],
          [data-testid*="sidebar"],
          [aria-label*="sidebar" i] {
            display: none !important;
            visibility: hidden !important;
          }
        `).catch(() => {});
      }
    }
  }

  // Открываем DevTools только в режиме разработки
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Обработка минимизации в трей
  mainWindow.on('close', (event) => {
    if (currentSettings.minimizeToTray && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Автоперезагрузка при потере соединения
  if (currentSettings.autoReload) {
    mainWindow.webContents.on('did-fail-load', (event, errorCode) => {
      if (errorCode !== -3) { // -3 это ERR_ABORTED
        setTimeout(() => {
          mainWindow.reload();
        }, 3000);
          }
        });
      }
      
  // Обработка навигации - остаемся на домене Perplexity и разрешаем домены капчи
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const allowedHosts = [
      'www.perplexity.ai',
      'perplexity.ai',
      'www.google.com',
      'google.com',
      'www.gstatic.com',
      'gstatic.com',
      'www.recaptcha.net',
      'recaptcha.net'
    ];
    
    const isAllowed = allowedHosts.some(host => 
      parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host)
    ) || parsedUrl.hostname.endsWith('.perplexity.ai');
    
    if (!isAllowed) {
      event.preventDefault();
    }
  });

  // Обработка новых окон - открываем в браузере, но разрешаем iframe капчи
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Разрешаем открытие iframe для капчи
    if (url.includes('recaptcha') || url.includes('gstatic.com') || url.includes('google.com')) {
      return { action: 'allow' };
    }
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
  
  // Разрешаем загрузку iframe для капчи
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    webContents.setUserAgent(userAgent);
  });
}

// Функция открытия окна настроек
function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 550,
    height: 600,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    parent: mainWindow,
    modal: false
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// Создание меню
function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Настройки',
          accelerator: 'CmdOrCtrl+,',
          click: () => openSettingsWindow()
        },
        { type: 'separator' },
        {
          label: 'Выход',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        {
          label: 'Перезагрузить',
          accelerator: 'CmdOrCtrl+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.reload();
          }
        },
        {
          label: 'Полная перезагрузка',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.reloadIgnoringCache();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Инструменты разработчика',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC обработчики для настроек
ipcMain.on('load-settings', (event) => {
  event.returnValue = currentSettings;
  event.sender.send('settings-loaded', currentSettings);
});

ipcMain.on('save-settings', (event, settings) => {
  const success = saveSettings(settings);
  currentSettings = settings;
  event.sender.send('settings-saved', success);
  
  if (success && mainWindow) {
    // Применяем zoom level
    if (settings.zoomLevel) {
      mainWindow.webContents.setZoomFactor(settings.zoomLevel);
    }
    
    // Применяем темную тему к окну
    if (settings.darkMode !== undefined) {
      mainWindow.setBackgroundColor(settings.darkMode ? '#1a1a1a' : '#ffffff');
    }
    
    // Перезагружаем страницу для применения новых настроек
      setTimeout(() => {
      mainWindow.reload();
    }, 500);
  }
});

// Создание системного трея
function createTray() {
  // Загружаем иконку из файла
  const iconPath = path.join(__dirname, 'icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    } else {
      // Масштабируем для трея (обычно нужен размер 16-22px)
      icon = icon.resize({ width: 22, height: 22 });
    }
  } catch(e) {
    console.error('Ошибка загрузки иконки трея:', e);
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Perlient',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    {
      label: 'Settings',
      click: () => {
        openSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Perlient');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

// Подавляем некритичные предупреждения процесса
if (process.platform === 'linux') {
  // Отключаем некоторые предупреждения для Linux
  process.on('uncaughtException', (error) => {
    // Игнорируем некритичные ошибки GL и connection
    if (error.message && (
      error.message.includes('gl_surface') ||
      error.message.includes('connection.cc') ||
      error.message.includes('service_worker_storage')
    )) {
      return;
    }
    console.error('Uncaught Exception:', error);
  });
}

app.whenReady().then(() => {
  // Устанавливаем ID приложения
  app.setAppUserModelId('com.perlient.app');
  
  // Устанавливаем иконку приложения (для Linux важно установить через dock если доступно)
  const iconPath = path.join(__dirname, 'icon.png');
  try {
    const appIcon = nativeImage.createFromPath(iconPath);
    if (!appIcon.isEmpty() && app.dock && app.dock.setIcon) {
      app.dock.setIcon(appIcon);
    }
  } catch(e) {
    console.error('Ошибка установки иконки приложения:', e);
  }
  
  createMenu();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !currentSettings.minimizeToTray) {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

