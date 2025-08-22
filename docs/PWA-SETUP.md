# PWA Configuration for Writeme

This document describes the Progressive Web App (PWA) configuration for the Writeme application.

## Overview

Writeme is now configured as both an Electron desktop application and a Progressive Web App, allowing users to:

- Install the app directly from their browser
- Use the app offline with service worker caching
- Receive app-like experience on mobile and desktop browsers
- Get automatic updates when new versions are available

## Configuration Files

### 1. Vite PWA Configuration (`vite.renderer.config.ts`)

The main PWA configuration is in the renderer config:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      // Google Fonts caching
      // Static assets caching
    ],
  },
  manifest: {
    name: 'Writeme - Rich Text Editor',
    short_name: 'Writeme',
    description: 'A powerful rich text editor with TipTap, syntax highlighting, and math support',
    theme_color: '#2563eb',
    background_color: '#ffffff',
    display: 'standalone',
    // Icons, shortcuts, and screenshots
  },
})
```

### 2. PWA Manifest Features

- **App Identity**: Name, description, and branding
- **Display**: Standalone mode for app-like experience
- **Icons**: Multiple sizes (192x192, 512x512) with maskable support
- **Shortcuts**: Quick actions for new notes and recent notes
- **Screenshots**: For app store listings and install prompts
- **Categories**: Productivity, utilities, education

### 3. Service Worker Caching

- **Static Assets**: JS, CSS, HTML, fonts automatically cached
- **Google Fonts**: Special caching strategy for web fonts
- **Runtime Caching**: Smart caching for external resources
- **Auto-Update**: Automatic service worker updates

## PWA Assets

Generated assets include:

```
public/
├── pwa-192x192.png       # Standard PWA icon
├── pwa-512x512.png       # Large PWA icon (maskable)
├── apple-touch-icon.png  # iOS home screen icon
├── mask-icon.svg         # Safari pinned tab icon
├── favicon.ico           # Browser favicon
├── screenshot-wide.png   # Desktop app preview
└── screenshot-narrow.png # Mobile app preview
```

## Scripts

### Available Commands

```bash
# Generate PWA assets
npm run pwa:assets

# Development with PWA features
npm run pwa:dev

# Build PWA for production
npm run pwa:build

# Standard development (Electron)
npm run dev

# Browser-only development
npm run browser:dev
```

### Asset Generation

PWA assets are automatically generated using `scripts/generate-pwa-assets.js`:

- Creates SVG-based icons with the "W" logo
- Generates multiple sizes for different use cases
- Creates placeholder screenshots for app stores
- Uses Writeme brand colors (#2563eb)

## Features

### 🚀 Core PWA Features

- ✅ **Offline Support**: Works without internet after first load
- ✅ **Install Prompt**: Users can install from browser
- ✅ **Auto Updates**: Automatic service worker updates
- ✅ **App Shortcuts**: Quick actions from home screen/dock
- ✅ **Responsive Design**: Works on mobile and desktop
- ✅ **Fast Loading**: Cached assets for instant startup

### 📱 Mobile Experience

- **Standalone Display**: Runs like a native app
- **Touch-Friendly**: Optimized for touch interactions
- **Status Bar Integration**: Proper mobile status bar handling
- **Home Screen Icon**: Can be added to home screen

### 🖥️ Desktop Experience

- **Window Integration**: Proper desktop window behavior
- **Keyboard Shortcuts**: Full keyboard support
- **File System Access**: (Future enhancement)
- **Native Menus**: (Future enhancement)

## Testing PWA Features

### 1. Development Testing

```bash
npm run pwa:dev
# Visit http://localhost:5174
# Open DevTools > Application > Service Workers
# Check manifest in Application > Manifest
```

### 2. Install Testing

1. Open the app in a supported browser (Chrome, Edge, Safari)
2. Look for install prompt or address bar install icon
3. Click install to add to home screen/applications
4. Launch installed app to test standalone mode

### 3. Offline Testing

1. Load the app online first
2. Open DevTools > Network > Toggle offline
3. Refresh page - should still work
4. Test editor functionality offline

### 4. Update Testing

1. Make changes and rebuild
2. Service worker should detect updates
3. User gets update prompt
4. App updates automatically after confirmation

## Browser Support

### ✅ Fully Supported
- Chrome 67+
- Edge 79+
- Firefox 79+
- Safari 13.1+

### ⚠️ Partial Support
- Safari 11.1+ (basic PWA features)
- Samsung Internet 8.2+

### ❌ Not Supported
- Internet Explorer
- Legacy browsers

## Deployment Considerations

### Production Checklist

- [ ] Icons are properly optimized
- [ ] Manifest URLs are absolute in production
- [ ] HTTPS is enabled (required for PWA)
- [ ] Service worker caching is appropriate
- [ ] Update prompts work correctly

### CDN/Hosting

- Ensure all PWA assets are properly cached
- Set correct MIME types for manifest files
- Configure HTTPS with valid certificates
- Test install prompts across devices

## Customization

### Icons

Replace generated icons with custom designs:

1. Create 512x512 source icon
2. Use `@vite-pwa/assets-generator` for automatic generation
3. Update `scripts/generate-pwa-assets.js` for custom generation

### Manifest

Modify `vite.renderer.config.ts` manifest section:

- Update app name and description
- Change theme colors
- Add/modify shortcuts
- Update categories and screenshots

### Caching Strategy

Adjust Workbox configuration:

- Modify `globPatterns` for different file types
- Add custom `runtimeCaching` rules
- Configure cache expiration policies
- Add background sync for offline actions

## Troubleshooting

### Common Issues

1. **Icons not showing**: Check icon paths in manifest
2. **Install prompt not appearing**: Verify HTTPS and manifest validity
3. **Service worker not updating**: Clear browser cache and storage
4. **Offline not working**: Check network tab for cached resources

### Debug Tools

- Chrome DevTools > Application tab
- Lighthouse PWA audit
- PWA Builder validation
- Service worker debug logs

## Future Enhancements

### Planned Features

- **File System Access API**: Direct file operations
- **Web Share API**: Share notes to other apps
- **Background Sync**: Sync notes when connection restored
- **Push Notifications**: Update notifications
- **Web App Shortcuts**: More quick actions

### Advanced PWA Features

- **Window Controls Overlay**: Custom title bar
- **Display Override**: Enhanced display modes
- **Protocol Handlers**: Handle writeme:// URLs
- **File Handling**: Open .md files directly

---

## Resources

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Vite PWA Plugin Docs](https://vite-pwa-org.netlify.app/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [PWA Builder](https://www.pwabuilder.com/)