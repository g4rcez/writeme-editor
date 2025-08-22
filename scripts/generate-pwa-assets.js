#!/usr/bin/env node

/**
 * Simple PWA asset generator for Writeme
 * This script creates basic PWA icons and assets
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

// Create a simple SVG icon template
const createIcon = (size, color = '#2563eb') => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${color}"/>
  <text x="${size/2}" y="${size * 0.65}" font-family="Arial, sans-serif" font-size="${size * 0.48}" font-weight="bold" fill="white" text-anchor="middle">W</text>
  <circle cx="${size * 0.75}" cy="${size * 0.25}" r="${size * 0.08}" fill="#60a5fa"/>
</svg>`;

// Generate assets
const assets = {
  'pwa-192x192.png': createIcon(192),
  'pwa-512x512.png': createIcon(512),
  'apple-touch-icon.png': createIcon(180),
  'mask-icon.svg': createIcon(100, '#000000'),
  'favicon.ico': createIcon(32), // Will be SVG for simplicity
};

// Write assets to public directory
Object.entries(assets).forEach(([filename, content]) => {
  const filepath = resolve('public', filename);
  writeFileSync(filepath, content);
  console.log(`Generated: ${filename}`);
});

// Create basic screenshots (placeholder)
const createScreenshot = (width, height, label) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f8fafc"/>
  <rect x="0" y="0" width="${width}" height="80" fill="#2563eb"/>
  <text x="${width/2}" y="50" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">Writeme</text>
  <rect x="20" y="100" width="${width-40}" height="${height-140}" fill="white" stroke="#e2e8f0" stroke-width="2" rx="8"/>
  <rect x="40" y="120" width="${width-80}" height="20" fill="#e2e8f0" rx="4"/>
  <rect x="40" y="160" width="${(width-80) * 0.7}" height="20" fill="#e2e8f0" rx="4"/>
  <rect x="40" y="200" width="${(width-80) * 0.9}" height="20" fill="#e2e8f0" rx="4"/>
  <text x="${width/2}" y="${height-30}" font-family="Arial, sans-serif" font-size="16" fill="#64748b" text-anchor="middle">${label}</text>
</svg>`;

writeFileSync('public/screenshot-wide.png', createScreenshot(1280, 720, 'Desktop Editor View'));
writeFileSync('public/screenshot-narrow.png', createScreenshot(750, 1334, 'Mobile Editor View'));

console.log('✅ PWA assets generated successfully!');
console.log('📱 Assets created:');
console.log('   - pwa-192x192.png');
console.log('   - pwa-512x512.png'); 
console.log('   - apple-touch-icon.png');
console.log('   - mask-icon.svg');
console.log('   - favicon.ico');
console.log('   - screenshot-wide.png');
console.log('   - screenshot-narrow.png');
console.log('');
console.log('💡 For production, consider using a proper image generation tool or designing custom icons.');