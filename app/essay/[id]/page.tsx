"use client";

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import EssayEditor from '@/components/EssayEditor';
import { SavedEssay } from '@/types';
import { CERTIFICATES, getCertificateDisplayName } from '@/constants/certificates';

export default function EssayPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const essayId = params.id as string;
    const isNew = searchParams.get('new') === 'true';

    const [essayData, setEssayData] = useState<{
        certificateId: string;
        band: string;
        target: string;
        essayId: string;
        contentType: "full" | "outline";
        outlineLanguage: "vietnamese" | "english";
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!essayId) {
            router.push('/');
            return;
        }

        if (isNew) {
            // Creating new essay - get params from URL
            const cert = searchParams.get('cert');
            const band = searchParams.get('band');
            const type = searchParams.get('type') as "full" | "outline" | null;
            const lang = searchParams.get('lang') as "vietnamese" | "english" | null;

            if (cert && band && type && lang) {
                const selectedCert = CERTIFICATES.find(c => c.id === cert);
                const target = selectedCert ? getCertificateDisplayName(cert, band) : "";

                setEssayData({
                    certificateId: cert,
                    band,
                    target,
                    essayId,
                    contentType: type,
                    outlineLanguage: lang
                });
            } else {
                // Missing required params, redirect
                router.push('/');
            }
        } else {
            // Load existing essay from localStorage
            const savedEssays = localStorage.getItem('saved_essays');
            if (savedEssays) {
                try {
                    const essays: SavedEssay[] = JSON.parse(savedEssays);
                    const found = essays.find(e => e.id === essayId);

                    if (found) {
                        setEssayData({
                            certificateId: found.certificateId,
                            band: found.band,
                            target: found.target,
                            essayId: found.id,
                            contentType: found.contentType || "full",
                            outlineLanguage: found.outlineLanguage || "vietnamese"
                        });
                    } else {
                        // Essay not found, redirect to home
                        console.warn(`Essay not found: ${essayId}`);
                        router.push('/');
                    }
                } catch (error) {
                    console.error('Error loading essay:', error);
                    router.push('/');
                }
            } else {
                // No saved essays, redirect
                router.push('/');
            }
        }

        setLoading(false);
    }, [essayId, isNew, searchParams, router]);

    if (loading) {
        return (
            <div className="h-screen bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 text-sm">Loading essay...</p>
                </div>
            </div>
        );
    }

    if (!essayData) {
        return null; // Will redirect
    }

    return (
        <EssayEditor
            certificateId={essayData.certificateId}
            band={essayData.band}
            target={essayData.target}
            essayId={isNew ? undefined : essayData.essayId}
            contentType={essayData.contentType}
            outlineLanguage={essayData.outlineLanguage}
            onQuit={() => router.push('/')}
        />
    );
}
