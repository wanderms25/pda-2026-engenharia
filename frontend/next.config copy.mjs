/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src blob: 'self'; object-src blob: 'self'; connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 https://nominatim.openstreetmap.org https://brasilapi.com.br https://viacep.com.br https://pda.wanderops.com.br https://api.wanderops.com.br http://204.216.159.125:8000;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
