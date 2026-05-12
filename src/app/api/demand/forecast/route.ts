import { NextResponse } from "next/server";

export const revalidate = 0;

export async function GET() {
  // TODO Step 6: 4-hour forecast in 15-min steps using time + weather forecast.
  return NextResponse.json({ points: [] });
}
