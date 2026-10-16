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

Themes provide font stacks through CSS variables; the browser uses available local/system fonts.

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

Room names use 1–20 lowercase letters, numbers, hyphens or underscores. Display names have a 15-character limit and messages have a 2,000-character limit. Messages are delivered live and saved in this browser; revisiting restores the history this device received. There is no server-side message archive. Missing credentials display an offline state and API requests return a clear configuration error.

Run `bun run lint`, `bunx tsc --noEmit`, and `bun run build` to check the app.

## Image sharing (works on Vercel)

Select a PNG, JPEG, GIF or WebP up to 5 MB using the image button. Images are resized to at most 1,280 pixels on their longest side, compressed, and base64-encoded entirely in the sender's browser. Large/detailed images are reduced further to keep the encoded data under 350,000 characters. Animated images become a still frame. Add an optional caption and send; recipients reconstruct and display the image and can save the compressed copy. Failed sends retain the attachment for retry.

Images travel as small text chunks through the existing Pusher relay, then are reassembled in recipients' browsers. No server disk, image host, or additional storage service is required. Pusher still transports the image data, and each chunk counts toward its message usage. Received images and messages are remembered in this browser. Users joining later do not receive earlier messages unless they were already saved on that device.

The older `/api/images` disk-upload endpoints remain for existing image references on persistent self-hosted installations, but the chat composer no longer calls them. They cannot provide persistent storage on Vercel. Self-hosted legacy storage defaults to `.data/images/`; `IMAGE_STORAGE_DIR` can point to a writable persistent directory. Upload errors now identify read-only/full storage and log the underlying server error.

Run `bun test` for image validation, relay reconstruction, and legacy storage tests.

## Themes, settings and remembered conversations

Open Settings from the sliders icon on the home screen or chat header. Choose Grove, Nord or Dawn, or import a CSS theme matching `Nord.css`: a `:root` block with the same color and font variables. Download the Nord template directly in Settings. Built-in files live in `public/themes/`. Imports read recognized palette/font declarations only; other selectors, external URLs and CSS imports are not executed. Custom themes are saved in this browser.

A first-party cookie remembers your username, last room, up to 10 recent rooms and selected theme for one year. Recent room buttons let you rejoin quickly. Messages you receive, including encoded images, are saved locally and restored when you revisit a room. History stays on this device and is not sent as cookies. Storage retains up to 100 messages per room across 10 rooms, within roughly 1.5 million serialized characters; oldest messages are dropped when that limit is reached. Blocked/full browser storage displays a warning. Live messages sent while you are away cannot be recovered from Pusher.

Settings → **Reset HiChat** → **Clear saved data** clears HiChat cookies, message history, recent rooms and imported themes, restores the default theme, and returns to the home screen. Other sites' or applications' storage is left alone.
