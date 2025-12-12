/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const target = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${target.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
