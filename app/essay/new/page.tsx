"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NewEssayModal from '@/components/NewEssayModal';

export default function NewEssayPage() {
    const router = useRouter();
    const [showModal, setShowModal] = useState(true);

    const handleCreateEssay = (
        certificateId: string,
        band: string,
        contentType: "full" | "outline",
        outlineLanguage: "vietnamese" | "english"
    ) => {
        // Generate new essay ID using timestamp
        const essayId = `essay_${Date.now()}`;

        // Navigate to essay editor with query params
        const params = new URLSearchParams({
            new: 'true',
            cert: certificateId,
            band: band,
            type: contentType,
            lang: outlineLanguage
        });

        router.push(`/essay/${essayId}?${params.toString()}`);
    };

    const handleCancel = () => {
        router.push('/');
    };

    if (!showModal) {
        router.push('/');
        return null;
    }

    return (
        <div className="h-screen bg-background-dark flex items-center justify-center">
            <NewEssayModal
                onConfirm={handleCreateEssay}
                onCancel={handleCancel}
            />
        </div>
    );
}
