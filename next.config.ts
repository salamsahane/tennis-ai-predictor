import type { NextConfig } from 'next';

// Replay recordings are read with fs at runtime, so the tracer cannot see them
const REPLAY_FILES = ['./data/replays/**/*.json'];

const nextConfig: NextConfig = {
  // Ensure we can use these server-side only packages in edge/serverless functions
  serverExternalPackages: ['@anthropic-ai/sdk', 'openai', '@google/generative-ai'],

  // Ship the recordings with every route that uses the provider registry
  outputFileTracingIncludes: {
    '/api/search': REPLAY_FILES,
    '/api/stream/\[matchId\]': REPLAY_FILES,
  },

  turbopack: {
    root: process.cwd(),
  }, // Silence the turbopack warning
};

export default nextConfig;
