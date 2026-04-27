/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/',      destination: '/portal.html' },
      { source: '/admin', destination: '/admin.html' },
    ];
  },
};
module.exports = nextConfig;
