"use client";

import { useState, useEffect } from "react";

interface UserCounterProps {
    className?: string;
}

// Simple browser fingerprint generator
function generateFingerprint(): string {
    if (typeof window === "undefined") return "";

    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 0,
    ];

    // Simple hash
    const str = components.join("|");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36) + Date.now().toString(36).slice(-4);
}

export default function UserCounter({ className = "" }: UserCounterProps) {
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function registerAndFetch() {
            try {
                // Check if already registered in this session
                const sessionKey = "user_counter_registered";
                const alreadyRegistered = sessionStorage.getItem(sessionKey);

                if (alreadyRegistered) {
                    // Just fetch count
                    const res = await fetch("/api/user-counter");
                    if (res.ok) {
                        const data = await res.json();
                        setTotalUsers(data.totalUsers);
                    }
                } else {
                    // Register new visit
                    const fingerprint = generateFingerprint();
                    const res = await fetch("/api/user-counter", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ fingerprint }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        setTotalUsers(data.totalUsers);
                        sessionStorage.setItem(sessionKey, "1");
                    }
                }
            } catch (error) {
                console.error("Error with user counter:", error);
            } finally {
                setIsLoading(false);
            }
        }

        registerAndFetch();
    }, []);

    if (isLoading || totalUsers === null) {
        return (
            <div className={`flex items-center gap-1.5 text-gray-400 text-sm ${className}`}>
                <span className="material-symbols-outlined text-base animate-pulse">group</span>
                <span>...</span>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-full text-sm ${className}`}
            title="Tổng số người đã sử dụng"
        >
            <span className="material-symbols-outlined text-base text-purple-400">group</span>
            <span className="text-gray-200 font-medium">
                {totalUsers.toLocaleString()}
            </span>
            <span className="text-gray-400 hidden sm:inline">người dùng</span>
        </div>
    );
}
