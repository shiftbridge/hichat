This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Chat configuration

Create `.env.local` with your Pusher Channels application's credentials:

```dotenv
PUSHER_APP_ID=your-app-id
NEXT_PUBLIC_PUSHER_KEY=your-public-key
PUSHER_SECRET=your-secret
NEXT_PUBLIC_PUSHER_CLUSTER=your-cluster
```

Enable **client events** in the Pusher dashboard for typing indicators. Restart the development server after changing environment variables. Only the `NEXT_PUBLIC_` values are exposed to the browser; keep the secret server-side.

Room names use 1–20 lowercase letters, numbers, hyphens or underscores. Display names have a 15-character limit and messages have a 2,000-character limit. Messages are delivered live and aren't persisted; joining or reloading starts a fresh view. Missing credentials display an offline state and API requests return a clear configuration error.

Run `bun run lint`, `bunx tsc --noEmit`, and `bun run build` to check the app.

## Image sharing (works on Vercel)

Select a PNG, JPEG, GIF or WebP up to 5 MB using the image button. Images are resized to at most 1,280 pixels on their longest side, compressed, and base64-encoded entirely in the sender's browser. Large/detailed images are reduced further to keep the encoded data under 350,000 characters. Animated images become a still frame. Add an optional caption and send; recipients reconstruct and display the image and can save the compressed copy. Failed sends retain the attachment for retry.

Images travel as small text chunks through the existing Pusher relay, then are reassembled in recipients' browsers. No server disk, image host, or additional storage service is required. Pusher still transports the image data, and each chunk counts toward its message usage. Images and messages are live-only: reloading clears them and users joining later do not receive earlier images.

The older `/api/images` disk-upload endpoints remain for existing image references on persistent self-hosted installations, but the chat composer no longer calls them. They cannot provide persistent storage on Vercel. Self-hosted legacy storage defaults to `.data/images/`; `IMAGE_STORAGE_DIR` can point to a writable persistent directory. Upload errors now identify read-only/full storage and log the underlying server error.

Run `bun test` for image validation, relay reconstruction, and legacy storage tests.
