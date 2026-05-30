import { NextResponse } from "next/server";
import { createVideoJob } from "../../lib/azure-ai";
import type { VideoRatio, VideoSeconds } from "../../lib/types";

const validSeconds = new Set(["4", "8", "12"]);
const validRatios = new Set(["16:9", "9:16"]);

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string; seconds?: string; ratio?: string };
  const prompt = body.prompt?.trim();
  const seconds = validSeconds.has(body.seconds || "") ? (body.seconds as VideoSeconds) : "4";
  const ratio = validRatios.has(body.ratio || "") ? (body.ratio as VideoRatio) : "16:9";

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  try {
    const job = await createVideoJob(prompt, seconds, ratio);
    return NextResponse.json({
      ...job,
      ratio,
      status: job.status === "queued" ? "queued" : "generating",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Azure video request failed." },
      { status: 500 },
    );
  }
}
