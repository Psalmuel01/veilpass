import path from 'node:path';
import { fileURLToPath } from 'node:url';
const webRoot = path.dirname(fileURLToPath(import.meta.url));
/** @type {import('next').NextConfig} */
const config = {
  distDir: process.env.VEILPASS_BUILD_DIR || ".next",
  outputFileTracingRoot: path.resolve(webRoot, '../..'),
  devIndicators: false,
  experimental: { externalDir: true },
  webpack(config, { isServer }) {
    config.output.environment = { ...config.output.environment, asyncFunction: true };
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    if (!isServer) config.resolve.alias = { ...config.resolve.alias, 'isomorphic-ws$': path.join(webRoot, 'lib/browser-websocket.ts') };
    if (!isServer) config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false, net: false, tls: false };
    return config;
  },
  async headers() { return [{ source: '/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' }] }]; }
};
export default config;
