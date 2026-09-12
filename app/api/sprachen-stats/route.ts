import { NextResponse } from "next/server";
import { mockStatProSprache } from "@/lib/mock-stat-pro-sprache";
export function GET() {
  return NextResponse.json(mockStatProSprache);
}