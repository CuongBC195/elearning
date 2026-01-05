"use client";

import { useState } from "react";
import EssayEditor from "@/components/EssayEditor";
import EssayList from "@/components/EssayList";
import NewEssayModal from "@/components/NewEssayModal";
import { SavedEssay } from "@/types";
import { CERTIFICATES, getCertificateDisplayName } from "@/constants/certificates";

type ViewMode = "list" | "editor";

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showNewModal, setShowNewModal] = useState(false);
  const [currentEssay, setCurrentEssay] = useState<{
    certificateId: string;
    band: string;
    target: string;
    essayId?: string;
    contentType?: "full" | "outline";
    outlineLanguage?: "vietnamese" | "english";
  } | null>(null);

  const handleNewEssay = () => {
    setShowNewModal(true);
  };

  const handleCreateEssay = (certificateId: string, band: string, contentType: "full" | "outline", outlineLanguage: "vietnamese" | "english") => {
    const selectedCert = CERTIFICATES.find(c => c.id === certificateId);
    const target = selectedCert ? getCertificateDisplayName(certificateId, band) : "";
    
    setCurrentEssay({ certificateId, band, target, contentType, outlineLanguage });
    setShowNewModal(false);
    setViewMode("editor");
  };

  const handleSelectEssay = (essay: SavedEssay) => {
    setCurrentEssay({
      certificateId: essay.certificateId,
      band: essay.band,
      target: essay.target,
      essayId: essay.id,
      contentType: essay.contentType || "full",
      outlineLanguage: essay.outlineLanguage || "vietnamese"
    });
    setViewMode("editor");
  };

  const handleQuit = () => {
    setViewMode("list");
    setCurrentEssay(null);
  };

  if (viewMode === "list") {
    return (
      <>
        <EssayList onSelectEssay={handleSelectEssay} onNewEssay={handleNewEssay} />
        {showNewModal && (
          <NewEssayModal
            onConfirm={handleCreateEssay}
            onCancel={() => setShowNewModal(false)}
          />
        )}
      </>
    );
  }

  if (!currentEssay) {
    return null;
  }

  return (
    <EssayEditor
      certificateId={currentEssay.certificateId}
      band={currentEssay.band}
      target={currentEssay.target}
      essayId={currentEssay.essayId}
      contentType={currentEssay.contentType}
      outlineLanguage={currentEssay.outlineLanguage}
      onQuit={handleQuit}
    />
  );
}

