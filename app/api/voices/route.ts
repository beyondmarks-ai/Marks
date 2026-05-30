import { NextResponse } from "next/server";

type ElevenLabsVoice = {
  voice_id?: string;
  name?: string;
  category?: string;
};

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs API key is missing." }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100&sort=name", {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    const data = (await response.json()) as {
      voices?: ElevenLabsVoice[];
      error?: string;
      detail?: { message?: string };
      message?: string;
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail?.message || data.message || data.error || "Could not load voices." },
        { status: response.status },
      );
    }

    return NextResponse.json({
      voices: (data.voices ?? [])
        .filter((voice) => voice.voice_id && voice.name)
        .map((voice) => ({
          id: voice.voice_id,
          name: voice.name,
          category: voice.category,
        })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load voices." },
      { status: 500 },
    );
  }
}
