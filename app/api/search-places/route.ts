import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 1) {
    return NextResponse.json({ items: [] });
  }

  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Naver Search API credentials not configured", items: [] },
      { status: 503 }
    );
  }

  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=10&sort=random`;

    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      next: { revalidate: 60 }, // cache 60 seconds
    });

    if (!response.ok) {
      throw new Error(`Naver API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse and convert coordinates
    // Naver Local Search API returns mapx/mapy in KATECH format (×10^6 of WGS84 degrees)
    const items = (data.items || []).map((item: {
      title: string;
      category: string;
      roadAddress: string;
      address: string;
      mapx: string;
      mapy: string;
      telephone: string;
    }) => ({
      title: item.title.replace(/<[^>]*>/g, ""), // strip HTML tags
      category: item.category || "",
      roadAddress: item.roadAddress || item.address || "",
      address: item.address || item.roadAddress || "",
      lng: parseInt(item.mapx) / 10_000_000,   // Naver Mapx → WGS84 longitude (divided by 10 million)
      lat: parseInt(item.mapy) / 10_000_000,   // Naver Mapy → WGS84 latitude (divided by 10 million)
      telephone: item.telephone || "",
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Naver search error:", error);
    return NextResponse.json({ items: [], error: "Search failed" }, { status: 500 });
  }
}
