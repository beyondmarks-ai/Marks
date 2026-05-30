import { NextResponse } from "next/server";
import { generateImage } from "../../lib/azure-ai";

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string };
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await generateImage(prompt));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Azure image request failed." },
      { status: 500 },
    );
  }
}
