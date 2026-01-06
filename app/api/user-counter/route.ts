import { NextResponse } from "next/server";
import { redis } from "@/lib/upstash";

// Redis keys
const TOTAL_USERS_KEY = "stats:total_users";
const USER_FINGERPRINT_PREFIX = "user:fp:";
const FINGERPRINT_TTL = 60 * 60 * 24 * 30; // 30 days

// GET: Get total user count
export async function GET() {
    try {
        const count = await redis.get<number>(TOTAL_USERS_KEY);
        return NextResponse.json({
            totalUsers: count || 0,
        });
    } catch (error) {
        console.error("Error getting user count:", error);
        return NextResponse.json({ totalUsers: 0 });
    }
}

// POST: Register a new user visit
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { fingerprint } = body;

        if (!fingerprint || typeof fingerprint !== "string" || fingerprint.length < 10) {
            return NextResponse.json({ error: "Invalid fingerprint" }, { status: 400 });
        }

        // Sanitize fingerprint (only alphanumeric)
        const sanitizedFp = fingerprint.replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
        const fpKey = `${USER_FINGERPRINT_PREFIX}${sanitizedFp}`;

        // Check if this fingerprint already exists
        const exists = await redis.get(fpKey);

        if (!exists) {
            // New user - increment counter
            await redis.incr(TOTAL_USERS_KEY);
            await redis.set(fpKey, Date.now(), { ex: FINGERPRINT_TTL });

            const newCount = await redis.get<number>(TOTAL_USERS_KEY);
            return NextResponse.json({
                isNewUser: true,
                totalUsers: newCount || 1,
            });
        }

        // Existing user - refresh TTL
        await redis.expire(fpKey, FINGERPRINT_TTL);
        const count = await redis.get<number>(TOTAL_USERS_KEY);

        return NextResponse.json({
            isNewUser: false,
            totalUsers: count || 0,
        });
    } catch (error) {
        console.error("Error registering user:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
