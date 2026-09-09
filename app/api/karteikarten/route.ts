import { NextResponse } from "next/server";
import { mockKarteikarten } from "@/lib/mock-karteikarten";

export function GET() {
  return NextResponse.json(mockKarteikarten);
}
