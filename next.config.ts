import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/signin', destination: '/auth', permanent: false },
      { source: '/login', destination: '/auth', permanent: false },
      { source: '/signup', destination: '/auth?signup=1', permanent: false },
      { source: '/register', destination: '/auth?signup=1', permanent: false },
    ]
  },
};

export default nextConfig;
