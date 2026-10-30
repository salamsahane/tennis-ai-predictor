import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ensure we can use these server-side only packages in edge/serverless functions
  serverExternalPackages: ['@anthropic-ai/sdk', 'openai', '@google/generative-ai'],

  turbopack: {
    root: process.cwd(),
  }, // Silence the turbopack warning
};

export default nextConfig;
