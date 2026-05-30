import { NextResponse } from "next/server";

const ELEVENLABS_SOUND_GENERATION_URL =
  "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128";

const filenameFor = (prompt: string) => {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${slug || "sound-effect"}.mp3`;
};

const readTextError = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return "ElevenLabs sound generation failed.";
  }

  try {
    const parsed = JSON.parse(text) as { detail?: { message?: string }; message?: string };
    return parsed.detail?.message || parsed.message || text;
  } catch {
    return text;
  }
};

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string };
  const prompt = body.prompt?.trim();
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs API key is missing." }, { status: 500 });
  }

  try {
    const response = await fetch(ELEVENLABS_SOUND_GENERATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: 4,
        prompt_influence: 0.45,
        model_id: "eleven_text_to_sound_v2",
      }),
    });

    if (!response.ok) {
      throw new Error(await readTextError(response));
    }

    const audio = await response.arrayBuffer();

    return new NextResponse(audio, {
      headers: {
        "Content-Disposition": `attachment; filename="${filenameFor(prompt)}"`,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate sound effect." },
      { status: 500 },
    );
  }
}
