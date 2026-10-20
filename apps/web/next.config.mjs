import path from 'node:path';
import { fileURLToPath } from 'node:url';
const webRoot = path.dirname(fileURLToPath(import.meta.url));
/** @type {import('next').NextConfig} */
const config = {
  distDir: process.env.VEILPASS_BUILD_DIR || ".next",
  outputFileTracingRoot: path.resolve(webRoot, '../..'),
  devIndicators: false,
  experimental: { externalDir: true },
  async rewrites() {
    const backend = process.env.VEILPASS_BACKEND_ORIGIN;
    if (!backend) return [];
    const url = new URL(backend);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      throw new Error('Backend must be an HTTPS origin without credentials or a path');
    // Override only these existing API routes. No arbitrary upstream URLs or
    // caller-supplied proxy paths; browser and frontend assets stay on Vercel.
    return { beforeFiles: ['issuance', 'signed-network'].map(name => ({
      source: `/api/${name}`, destination: `${url.origin}/api/${name}`,
    })) };
  },
  webpack(config, { isServer }) {
    config.resolve.extensionAlias = { ...config.resolve.extensionAlias, '.js': ['.ts', '.tsx', '.js'] };
    config.output.environment = { ...config.output.environment, asyncFunction: true };
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    if (!isServer) config.resolve.alias = { ...config.resolve.alias, 'isomorphic-ws$': path.join(webRoot, 'lib/browser-websocket.ts') };
    if (!isServer) config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false, net: false, tls: false };
    return config;
  },
  async headers() { return [{ source: '/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' }] }]; }
};
export default config;
