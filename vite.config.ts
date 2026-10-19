import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Watchers Bible",
        short_name: "Watchers",
        description:
          "A free, offline-first Bible. 25 translations, instant search, highlights and notes — all on your device.",
        theme_color: "#121216",
        background_color: "#121216",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/bible\//, /^\/sqlite\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/bible\/[^/]+\.sqlite$/,
            handler: "CacheFirst",
            options: {
              cacheName: "bible-corpora",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /\/bible\/manifest\.json$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "bible-manifest",
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /\/sqlite\//,
            handler: "CacheFirst",
            options: {
              cacheName: "sqlite-wasm",
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});
