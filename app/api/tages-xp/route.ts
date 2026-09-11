import { NextResponse } from "next/server";
import { TagesXp } from "@/lib/mock-xp-heute";
export function GET() {
    return NextResponse.json(TagesXp);
}