import type { VideoRatio, VideoSeconds } from "./types";

export type AzureImageResult = {
  mediaUrl?: string;
  mediaDataUrl?: string;
};

export type AzureVideoResult = {
  mediaUrl?: string;
  jobId?: string;
  status?: string;
  progress?: number;
  error?: unknown;
};

const readTextError = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return "Azure OpenAI request failed.";
  }

  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || text;
  } catch {
    return text;
  }
};

export type AzureChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const generateChatAnswer = async (prompt: string, history: AzureChatMessage[] = []) => {
  const url = process.env.AZURE_OPENAI_CHAT_URL;
  const apiKey = process.env.AZURE_OPENAI_CHAT_API_KEY;

  if (!url || !apiKey) {
    throw new Error("Azure chat endpoint or key is missing.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "You are AERO, a concise, helpful assistant inside a creative dashboard. Answer clearly and professionally.",
        },
        ...history.slice(-16).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: "user", content: prompt },
      ],
      max_tokens: 700,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(await readTextError(response));
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = data.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error("Azure chat returned an empty response.");
  }

  return answer;
};

export const suggestMediaTitle = async (prompt: string, type: "image" | "video") => {
  const answer = await generateChatAnswer(
    `Create one professional ${type} title from this prompt. Return only 3 to 4 words. No quotes. Prompt: ${prompt}`,
  );
  const cleanedTitle = answer
    .replace(/^["']|["']$/g, "")
    .replace(/[.?!]+$/g, "")
    .trim();
  const words = cleanedTitle.split(/\s+/).filter(Boolean).slice(0, 4);

  return words.length ? words.join(" ") : type === "image" ? "Image creation" : "Video creation";
};

export const generateImage = async (prompt: string): Promise<AzureImageResult> => {
  const url = process.env.AZURE_OPENAI_IMAGE_URL;
  const apiKey = process.env.AZURE_OPENAI_IMAGE_API_KEY;

  if (!url || !apiKey) {
    throw new Error("Azure image endpoint or key is missing.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      prompt,
      n: 1,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    throw new Error(await readTextError(response));
  }

  const data = (await response.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const firstImage = data.data?.[0];

  if (firstImage?.url) {
    return { mediaUrl: firstImage.url };
  }

  if (firstImage?.b64_json) {
    return { mediaDataUrl: `data:image/png;base64,${firstImage.b64_json}` };
  }

  throw new Error("Azure image generation returned no image.");
};

export const createVideoJob = async (
  prompt: string,
  seconds: VideoSeconds = "4",
  ratio: VideoRatio = "16:9",
): Promise<AzureVideoResult> => {
  const url = process.env.AZURE_OPENAI_VIDEO_URL;
  const apiKey = process.env.AZURE_OPENAI_VIDEO_API_KEY;
  const model = process.env.AZURE_OPENAI_VIDEO_MODEL || "sora-2";

  if (!url || !apiKey) {
    throw new Error("Azure video endpoint or key is missing.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      prompt,
      seconds,
      size: ratio === "9:16" ? "720x1280" : "1280x720",
    }),
  });

  if (!response.ok) {
    throw new Error(await readTextError(response));
  }

  const data = (await response.json()) as {
    id?: string;
    status?: string;
    url?: string;
    data?: Array<{ url?: string }>;
  };

  return {
    jobId: data.id,
    status: data.status || "generating",
    mediaUrl: data.url || data.data?.[0]?.url,
  };
};

const videoUrlFor = (videoId: string, suffix = "") => {
  const url = process.env.AZURE_OPENAI_VIDEO_URL;
  if (!url) {
    throw new Error("Azure video endpoint is missing.");
  }

  return `${url.replace(/\/$/, "")}/${videoId}${suffix}`;
};

export const getVideoJob = async (videoId: string): Promise<AzureVideoResult> => {
  const apiKey = process.env.AZURE_OPENAI_VIDEO_API_KEY;

  if (!apiKey) {
    throw new Error("Azure video key is missing.");
  }

  const response = await fetch(videoUrlFor(videoId), {
    headers: {
      "api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(await readTextError(response));
  }

  const data = (await response.json()) as {
    id?: string;
    status?: string;
    progress?: number;
    error?: unknown;
  };

  return {
    jobId: data.id || videoId,
    status: data.status,
    progress: data.progress,
    error: data.error,
    mediaUrl: data.status === "completed" ? `/api/video/${videoId}/content` : undefined,
  };
};

export const fetchVideoContent = async (videoId: string) => {
  const apiKey = process.env.AZURE_OPENAI_VIDEO_API_KEY;

  if (!apiKey) {
    throw new Error("Azure video key is missing.");
  }

  const response = await fetch(videoUrlFor(videoId, "/content"), {
    headers: {
      "api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(await readTextError(response));
  }

  return response;
};
