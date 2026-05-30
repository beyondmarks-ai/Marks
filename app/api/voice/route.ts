import { NextResponse } from "next/server";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

const filenameFor = (prompt: string) => {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${slug || "voice-reply"}.mp3`;
};

const readTextError = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return "ElevenLabs voice generation failed.";
  }

  try {
    const parsed = JSON.parse(text) as { detail?: { message?: string }; message?: string };
    return parsed.detail?.message || parsed.message || text;
  } catch {
    return text;
  }
};

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: string; title?: string; voiceId?: string };
  const text = body.text?.trim();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = body.voiceId?.trim() || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  if (!text) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs API key is missing." }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
        }),
      },
    );

    if (!response.ok) {
      throw new Error(await readTextError(response));
    }

    const audio = await response.arrayBuffer();

    return new NextResponse(audio, {
      headers: {
        "Content-Disposition": `attachment; filename="${filenameFor(body.title || text)}"`,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate voice reply." },
      { status: 500 },
    );
  }
}
