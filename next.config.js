/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    webpack: (config) => {
      // Fix for Konva 'canvas' module not found
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
        jsdom: false,
      };

      // Required for CanvasKit-WASM
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
      return config;
    },
  };
  
  module.exports = nextConfig;
  