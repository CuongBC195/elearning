export interface CertificateConfig {
  id: string;
  name: string;
  fullName: string;
  bands: string[];
  format: string; // Mô tả format đề bài
}

export const CERTIFICATES: CertificateConfig[] = [
  {
    id: "ielts-academic",
    name: "IELTS Academic",
    fullName: "International English Language Testing System (Academic)",
    bands: ["4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"],
    format: "Academic essay với độ dài 250-300 từ, yêu cầu phân tích, so sánh, đánh giá. Chủ đề thường về giáo dục, công nghệ, môi trường, xã hội."
  },
  {
    id: "ielts-general",
    name: "IELTS General",
    fullName: "International English Language Testing System (General Training)",
    bands: ["4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"],
    format: "General essay với độ dài 250-300 từ, chủ đề về cuộc sống hàng ngày, công việc, sở thích."
  },
  {
    id: "toeic",
    name: "TOEIC",
    fullName: "Test of English for International Communication",
    bands: ["200", "300", "400", "500", "600", "700", "800", "850", "900", "950", "990"],
    format: "Business-oriented essay, độ dài 200-250 từ, chủ đề về công việc, kinh doanh, giao tiếp công sở."
  },
  {
    id: "toefl-ibt",
    name: "TOEFL iBT",
    fullName: "Test of English as a Foreign Language (Internet-based Test)",
    bands: ["0-30", "31-60", "61-90", "91-110", "111-120"],
    format: "Academic essay, độ dài 300-350 từ, yêu cầu lập luận chặt chẽ, ví dụ cụ thể. Chủ đề học thuật."
  },
  {
    id: "cambridge-b2",
    name: "Cambridge B2 (FCE)",
    fullName: "Cambridge English: First (B2 First)",
    bands: ["140-159", "160-172", "173-179", "180-190"],
    format: "Essay theo format Cambridge, độ dài 140-190 từ, chủ đề phong phú, yêu cầu thể hiện ý kiến cá nhân."
  },
  {
    id: "cambridge-c1",
    name: "Cambridge C1 (CAE)",
    fullName: "Cambridge English: Advanced (C1 Advanced)",
    bands: ["160-179", "180-192", "193-199", "200-210"],
    format: "Essay nâng cao, độ dài 220-260 từ, chủ đề phức tạp, yêu cầu ngôn ngữ học thuật và phân tích sâu."
  },
  {
    id: "pte-academic",
    name: "PTE Academic",
    fullName: "Pearson Test of English Academic",
    bands: ["10-30", "31-50", "51-70", "71-84", "85-90"],
    format: "Academic essay, độ dài 200-300 từ, chủ đề học thuật, yêu cầu cấu trúc rõ ràng và từ vựng chuyên ngành."
  },
  {
    id: "vstep",
    name: "VSTEP",
    fullName: "Vietnamese Standardized Test of English Proficiency",
    bands: ["A1", "A2", "B1", "B2", "C1", "C2"],
    format: "Essay theo Khung năng lực ngoại ngữ 6 bậc Việt Nam, độ dài 250-350 từ, chủ đề phù hợp với từng bậc, yêu cầu thể hiện năng lực ngôn ngữ theo chuẩn VNQF."
  }
];

export function getCertificateById(id: string): CertificateConfig | undefined {
  return CERTIFICATES.find(cert => cert.id === id);
}

export function getCertificateDisplayName(certificateId: string, band: string): string {
  const cert = getCertificateById(certificateId);
  if (!cert) return `${certificateId} ${band}`;
  
  if (cert.id.includes("ielts")) {
    return `${cert.name} Band ${band}`;
  } else if (cert.id.includes("toeic")) {
    return `${cert.name} ${band} Points`;
  } else if (cert.id.includes("toefl")) {
    return `${cert.name} ${band}`;
  } else if (cert.id.includes("cambridge")) {
    return `${cert.name} (${band})`;
  } else if (cert.id.includes("pte")) {
    return `${cert.name} ${band}`;
  }
  
  return `${cert.name} ${band}`;
}

