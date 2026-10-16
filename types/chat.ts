import type { ChatGif } from "@/lib/gifs";
export interface ChatImage {
  id: string;
  name: string;
  data?: string;
}

export interface Message {
  id: string;
  room: string;
  user: string;
  text: string;
  timestamp: string;
  image?: ChatImage;
  gif?: ChatGif;
}
