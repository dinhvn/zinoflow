/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TS/TSX source -> Next phai transpile (image-compositions dung Remotion).
  transpilePackages: ["@zinoflow/contracts", "@zinoflow/image-compositions"],
};

export default nextConfig;
