import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "0.0.0"),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Jvala",
        short_name: "Jvala",
        description: "AI-powered flare tracking for chronic conditions",
        start_url: "/",
        display: "standalone",
        background_color: "#0a0a0a",
        theme_color: "#D6006C",
        orientation: "portrait-primary",
        categories: ["health", "medical", "lifestyle"],
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          {
            name: "Quick Log",
            short_name: "Log",
            description: "Quickly log how you're feeling",
            url: "/?action=quick-log",
          },
          {
            name: "View Insights",
            short_name: "Insights",
            description: "See your health patterns",
            url: "/?view=insights",
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB limit
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  /**
   * Native-only Capacitor plugins (e.g. Geolocation) should not break web/PWA production builds.
   * We externalize them so Rollup doesn’t need to resolve/bundle them for the web build.
   */
  build: {
    rollupOptions: {
      external: [
        "@capacitor/geolocation",
        "@capacitor/browser",
        "@capacitor/app",
      ],
    },
  },
  optimizeDeps: {
    exclude: [
      "@capacitor/geolocation",
      "@capacitor/browser",
      "@capacitor/app",
    ],
  },
}));

