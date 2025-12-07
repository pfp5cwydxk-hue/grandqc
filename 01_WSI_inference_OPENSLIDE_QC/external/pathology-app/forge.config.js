// Minimal Electron Forge config compatible with recent forge versions
module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.pathology.grandqc',
  },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-zip', config: { platforms: ['darwin', 'linux'] } },
    { name: '@electron-forge/maker-dmg', config: { format: 'UDZO' } },
  ],
  plugins: [
    { name: '@electron-forge/plugin-auto-unpack-natives', config: {} },
    { name: '@electron-forge/plugin-vite', config: {
      build: [
        { entry: 'src/main.ts', config: 'vite.main.config.ts', target: 'main' },
        { entry: 'src/preload.ts', config: 'vite.preload.config.ts', target: 'preload' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
      ],
    } },
  ],
};
