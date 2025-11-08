const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

// Настройки по умолчанию
const defaultSettings = {
  hideSidebar: true,
  hideBanner: true,
  replaceText: true,
  hideNavigation: true,
  darkMode: false,
  windowWidth: 1200,
  windowHeight: 800,
  minimizeToTray: false,
  startMinimized: false,
  customCSS: '',
  zoomLevel: 1.0,
  autoReload: false,
  blockAds: true,
  disableAll: false
};

// Загрузка настроек
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Ошибка загрузки настроек:', error);
  }
  return defaultSettings;
}

// Сохранение настроек
function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Ошибка сохранения настроек:', error);
    return false;
  }
}

module.exports = {
  loadSettings,
  saveSettings,
  defaultSettings
};

