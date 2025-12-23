const { createProxyMiddleware } = require('http-proxy-middleware');

const DEFAULT_TARGET = 'http://localhost:8080';

module.exports = function(app) {
  const target = process.env.NASCRAFT_BACKEND_TARGET || DEFAULT_TARGET;

  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      onError: (err, req, res) => {
        console.log('Proxy Error:', err);
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({
          status: 0,
          code: '500',
          message: '服务器连接失败，请检查后端服务是否启动',
        }));
      }
    })
  );
}; 