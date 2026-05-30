import { fetchVideoContent } from "../../../../lib/azure-ai";

export async function GET(
  _request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await context.params;
  const response = await fetchVideoContent(videoId);

  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "video/mp4",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
