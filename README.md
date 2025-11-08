# Perlient

Perlient is a minimalistic desktop client for Perplexity AI with extensive customization options. Built with Electron, it provides a native desktop experience with the ability to modify the interface according to your preferences.

## Features

- Customizable sidebar visibility
- Hide navigation elements
- Remove promotional banners
- Dark mode support
- Custom CSS injection
- Window size and position settings
- Minimize to system tray
- Start minimized option
- Zoom level control
- Auto-reload functionality
- Ad blocking
- Branding customization (rename "Perplexity" to "Perlient")

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Pygrammerik/Perlient.git
cd Perlient
```

2. Install dependencies:
```bash
npm install
```

3. Generate application icon:
```bash
npm run generate-icon
```

4. Start the application:
```bash
npm start
```

## Building

### Linux (AppImage)

```bash
npm run build:linux
```

The AppImage will be created in the `dist` directory.

### Windows (EXE)

```bash
npm run build:win
```

This will create both:
- NSIS installer (in `dist` directory)
- Portable EXE (in `dist` directory)

### Build for all platforms

```bash
npm run build:all
```

## Usage

### Settings Panel

Access the settings panel from the application menu (File > Settings) or use the system tray icon.

Available settings:

- **Interface**: Toggle sidebar, navigation, and banner visibility
- **Branding**: Replace "Perplexity" text with "Perlient"
- **Appearance**: Dark mode, window size, zoom level
- **Behavior**: Minimize to tray, start minimized, auto-reload
- **Advanced**: Custom CSS injection, ad blocking
- **Troubleshooting**: Disable all modifications

### Customization

All settings are saved in `settings.json` in the application directory. You can manually edit this file or use the settings panel.

## Project Structure

```
perlient/
├── main.js           # Main Electron process
├── settings.js       # Settings management
├── settings.html     # Settings UI
├── package.json      # Project configuration
├── icon.png          # Application icon
├── generate-icon.js  # Icon generation script
└── README.md         # This file
```

## Configuration

Settings are stored in `settings.json` with the following options:

- `hideSidebar`: Hide the sidebar (default: true)
- `hideNavigation`: Hide navigation elements (default: true)
- `hideBanner`: Hide promotional banners (default: true)
- `replaceText`: Replace "Perplexity" with "Perlient" (default: true)
- `darkMode`: Enable dark mode (default: false)
- `windowWidth`: Window width in pixels (default: 1200)
- `windowHeight`: Window height in pixels (default: 800)
- `minimizeToTray`: Minimize to system tray instead of closing (default: false)
- `startMinimized`: Start application minimized (default: false)
- `customCSS`: Custom CSS to inject (default: "")
- `zoomLevel`: Zoom level (0.5 to 3.0, default: 1.0)
- `autoReload`: Automatically reload page on changes (default: false)
- `blockAds`: Block advertisements (default: false)
- `disableAll`: Disable all modifications (default: false)

## Development

### Running in development mode

```bash
npm run dev
```

This will start the application with DevTools enabled.

### Scripts

- `npm start` - Start the application
- `npm run dev` - Start with DevTools
- `npm run generate-icon` - Generate application icon
- `npm run build` - Build for Linux (AppImage)
- `npm run build:linux` - Build for Linux (AppImage)
- `npm run build:win` - Build for Windows (EXE)
- `npm run build:all` - Build for all platforms

## Troubleshooting

### White screen issue

If you see a white screen:
1. Open Settings (File > Settings)
2. Enable "Disable All Modifications"
3. Reload the application
4. Check if the site loads without modifications

### Modifications not applying

1. Check if "Disable All Modifications" is unchecked
2. Save settings and reload the application
3. Wait a few seconds for modifications to apply

### Captcha not working

The application is configured to work with reCAPTCHA. If you encounter issues:
1. Ensure you're using the latest version
2. Check your internet connection
3. Try disabling ad blocking temporarily

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Pygrammerik

