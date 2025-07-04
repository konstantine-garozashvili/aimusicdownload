import { GoogleGenAI } from "@google/genai";
import { VideoResult } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

function getYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      return urlObj.searchParams.get('v');
    }
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
  } catch (error) {
    console.error("Invalid URL for ID extraction:", url, error);
  }
  return null;
}

export const searchMusicWithAI = async (query: string): Promise<VideoResult[]> => {
  const prompt = `
    Based on the following user query, suggest exactly 3 YouTube music videos.
    The query might be lyrics, a mood, or a description.
    For each suggestion, provide the song title, artist, and a valid YouTube URL.
    Return the result as a valid JSON array of objects, where each object has the keys "title", "artist", and "youtubeUrl".
    Do not include any other text, explanations, or markdown fences in your response. Just the raw JSON array.
    User's query: "${query}"
  `;

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsedData: Omit<VideoResult, 'thumbnailUrl'>[] = JSON.parse(jsonStr);

    if (!Array.isArray(parsedData)) {
        throw new Error("AI response is not a valid array.");
    }

    return parsedData.map(item => {
      const videoId = getYouTubeVideoId(item.youtubeUrl);
      return {
        ...item,
        thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : 'https://picsum.photos/480/360',
      };
    });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to get suggestions from AI. Please check your query or API key.");
  }
};
