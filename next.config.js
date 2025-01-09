/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'storage.googleapis.com',
      'arweave.net',
      'www.arweave.net',
      'ipfs.io',
      'nftstorage.link',
      'updg8.com',
      'img.hi-hi.vip'
    ],
  },
}

module.exports = nextConfig 