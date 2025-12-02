import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  base: './', // 使用相对路径，确保部署到任何路径都能工作
  build: {
    outDir: 'dist',
    sourcemap: false,
    assetsDir: 'assets',
    // 确保 public 目录的文件被复制到 dist 根目录
    copyPublicDir: true,
  },
  server: {
    host: true, // 允许局域网访问
    port: 5173,
    // 本地开发不使用 HTTPS，避免证书问题
    // 注意：摄像头在 localhost 上即使是 HTTP 也能工作
    // 如需在局域网测试摄像头，需要使用 HTTPS 或通过 Netlify 部署
    https: false,
    // 注意：COOP/COEP 头在 HTTP 环境下会被浏览器忽略
    // 这些头只在生产环境（Netlify HTTPS）下生效
    // headers: {
    //   'Cross-Origin-Opener-Policy': 'same-origin',
    //   'Cross-Origin-Embedder-Policy': 'require-corp',
    // },
  },
  // 优化依赖预构建
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
});