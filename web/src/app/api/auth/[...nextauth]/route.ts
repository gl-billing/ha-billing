import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

async function safeAuthHandler(req: Request, context: RouteContext) {
  try {
    return await handler(req, context);
  } catch (error) {
    console.error("[next-auth]", error);
    // NextAuth's client expects JSON — never return plain-text 500 pages.
    return NextResponse.json({}, { status: 200 });
  }
}

export async function GET(req: Request, context: RouteContext) {
  return safeAuthHandler(req, context);
}

export async function POST(req: Request, context: RouteContext) {
  return safeAuthHandler(req, context);
}
