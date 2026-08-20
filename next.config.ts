
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages compatibility
  // output: 'standalone',
  async headers() {
    return [
      {
        // Service worker must never be served from HTTP cache — browsers need
        // to detect the updated file immediately on every navigation so the old
        // SW (which had a broken fetch passthrough) is replaced as fast as possible.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  reactStrictMode: false, // Performance boost
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', '@radix-ui/react-icons', 'clsx', 'tailwind-merge', 'recharts', 'date-fns'],
  },
  // Sem override de splitChunks: o cacheGroup "vendors" com chunks:'all' que
  // existia aqui fundia TODOS os node_modules num chunk único de ~515 kB pago
  // por todas as rotas (recharts entrava até em página sem gráfico). O
  // chunking padrão do Next divide vendor por página, que é o comportamento
  // que queremos no mobile.
};

export default nextConfig;
