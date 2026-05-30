import { NextResponse } from "next/server";
import { getVideoJob } from "../../../lib/azure-ai";

export async function GET(
  _request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await context.params;

  try {
    return NextResponse.json(await getVideoJob(videoId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load video status." },
      { status: 500 },
    );
  }
}
