import { NextResponse } from "next/server";
import { generateChatAnswer, type AzureChatMessage } from "../../lib/azure-ai";

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string; messages?: AzureChatMessage[] };
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  try {
    const answer = await generateChatAnswer(prompt, body.messages ?? []);
    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Azure chat request failed." },
      { status: 500 },
    );
  }
}
