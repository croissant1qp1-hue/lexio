import { NextResponse } from "next/server";
import { WochenXp } from "@/lib/mock-xp-pro-tag";
export function GET() {
    return NextResponse.json(WochenXp)
}