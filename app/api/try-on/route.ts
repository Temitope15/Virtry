import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { MERCH_CATALOG } from "@/lib/merchData";
import { buildTryOnPrompt } from "@/lib/tryOnPrompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-2.5-flash-image";

interface RequestBody {
  photoDataUrl?: string;
  merchId?: string;
}

function dataUrlToInlinePart(dataUrl: string) {
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid photo data URL");
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

async function urlToInlinePart(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch merch image (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/png";
  return { inlineData: { mimeType, data: buf.toString("base64") } };
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing GEMINI_API_KEY." },
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { photoDataUrl, merchId } = body;
  if (!photoDataUrl || !merchId) {
    return NextResponse.json(
      { error: "photoDataUrl and merchId are required." },
      { status: 400 },
    );
  }

  const item = MERCH_CATALOG.find((m) => m.id === merchId);
  if (!item) {
    return NextResponse.json(
      { error: `Unknown merch id: ${merchId}` },
      { status: 404 },
    );
  }

  try {
    const photoPart = dataUrlToInlinePart(photoDataUrl);
    const merchPart = await urlToInlinePart(item.cloudinaryUrl);
    const prompt = buildTryOnPrompt(item);

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [photoPart, merchPart, { text: prompt }],
        },
      ],
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      const textPart = parts.find((p) => p.text);
      return NextResponse.json(
        {
          error:
            textPart?.text?.trim() ||
            "Gemini did not return an image for this request.",
        },
        { status: 502 },
      );
    }

    const mimeType = imagePart.inlineData.mimeType ?? "image/png";
    const imageDataUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    return NextResponse.json({ imageDataUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
