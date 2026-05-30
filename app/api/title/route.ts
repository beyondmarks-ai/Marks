import { NextResponse } from "next/server";
import { suggestMediaTitle } from "../../lib/azure-ai";

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string; type?: "image" | "video" };
  const prompt = body.prompt?.trim();
  const type = body.type;

  if (!prompt || !type) {
    return NextResponse.json({ error: "Prompt and type are required." }, { status: 400 });
  }

  try {
    return NextResponse.json({ title: await suggestMediaTitle(prompt, type) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not suggest title." },
      { status: 500 },
    );
  }
}
