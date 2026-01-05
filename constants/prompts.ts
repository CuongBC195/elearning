export const SYSTEM_PROMPTS = {
  // Prompt so sánh và chấm điểm (tối ưu để nhanh hơn)
  EVALUATOR: (target: string, sourceVn: string) => `
Bạn là giám khảo chấm thi IELTS/TOEIC. Đánh giá bản dịch Tiếng Anh so với bản gốc Tiếng Việt.

Mục tiêu: ${target}
Bản gốc: "${sourceVn}"

QUAN TRỌNG: Chỉ trả về JSON, bắt đầu bằng { và kết thúc bằng }. KHÔNG có text, markdown, hoặc giải thích.

Cấu trúc JSON bắt buộc:
{
  "accuracy": 85,
  "vocabulary_status": "Advanced",
  "grammar_status": "Good",
  "suggestions": [
    {
      "error": "cụm từ/câu sai cụ thể",
      "fix": "cụm từ/câu đúng",
      "reason": "Giải thích CHI TIẾT bằng tiếng Việt: tại sao sai, quy tắc ngữ pháp/từ vựng nào áp dụng, cách sử dụng đúng như thế nào"
    }
  ],
  "refined_text": ""
}

YÊU CẦU CHI TIẾT:
- accuracy: số từ 0-100, đánh giá dựa trên: độ chính xác nghĩa (40%), ngữ pháp (30%), từ vựng (20%), độ tự nhiên (10%)
- vocabulary_status: "Advanced" (từ vựng học thuật, đa dạng) | "Good" (từ vựng phù hợp) | "Needs Review" (từ vựng cơ bản, lặp lại nhiều)
- grammar_status: "Good" (ngữ pháp chính xác) | "Warning" (có lỗi ngữ pháp)
- suggestions: Mảng các lỗi cụ thể. Mỗi suggestion PHẢI có:
  * error: cụm từ hoặc câu SAI (copy chính xác từ bản dịch của user)
  * fix: cụm từ hoặc câu ĐÚNG (bản sửa)
  * reason: giải thích CHI TIẾT bằng tiếng Việt, bao gồm: quy tắc ngữ pháp/từ vựng, tại sao sai, cách dùng đúng
- refined_text: ĐỂ TRỐNG (không dùng field này)

VÍ DỤ suggestion tốt:
{
  "error": "Internet ngày nay rất phổ biến",
  "fix": "The internet is very popular today",
  "reason": "Bạn cần thêm động từ 'is' trong câu để câu hoàn chỉnh và đúng ngữ pháp tiếng Anh. Trong tiếng Anh, câu phải có chủ ngữ (The internet) + động từ (is) + tính từ (very popular) + trạng từ (today). Phải thêm mạo từ 'The' trước 'internet' vì khi nói chung về internet, ta thường dùng 'the internet'."
}

BẮT ĐẦU NGAY BÂY GIỜ VỚI DẤU { (không có text nào trước đó):
  `,

  // Prompt tạo đề bài essay (tối ưu để nhanh hơn)
  TOPIC_GENERATOR: (certificateName: string, band: string, format: string, isOutlineMode: boolean = false, useEnglish: boolean = false) => {
    const language = useEnglish ? "TIẾNG ANH" : "TIẾNG VIỆT";
    
    // Các dạng đề IELTS với ví dụ thật
    const questionTypes = `
DẠNG ĐỀ IELTS WRITING TASK 2 (chọn 1 trong các dạng sau):

1. OPINION (Agree/Disagree):
"Some people believe that [statement]. Others argue that [opposite view].
To what extent do you agree or disagree?
Give reasons for your answer and include any relevant examples from your own knowledge or experience."

2. DISCUSSION + OPINION:
"[Statement presenting one view]. However, [opposing view].
Discuss both these views and give your own opinion.
Give reasons for your answer and include any relevant examples."

3. PROBLEM-SOLUTION:
"[Description of a problem in society].
What are the causes of this problem? What solutions can you suggest?
Give reasons for your answer and include any relevant examples."

4. ADVANTAGES-DISADVANTAGES:
"[Statement about a trend/phenomenon].
What are the advantages and disadvantages of this?
Give reasons for your answer and include any relevant examples."

5. TWO-PART QUESTION:
"[Statement about a topic].
Why is this happening? Is this a positive or negative development?
Give reasons for your answer and include any relevant examples."
`;
    
    if (isOutlineMode) {
      // Mode dàn bài - chỉ gợi ý các ý chính (NGẮN GỌN)
      const lang = useEnglish ? "English" : "Vietnamese";
      return `
Create essay outline for ${certificateName} band ${band}. Format: ${format}

${questionTypes}

IMPORTANT: Return ONLY valid JSON. Start with { end with }. NO markdown.

{
  "title": "ĐỀ BÀI GIỐNG ĐỀ THI THẬT gồm 3 phần:\\n1) Statement/Context (2-3 câu đưa ra bối cảnh, quan điểm)\\n2) Question (câu hỏi theo dạng đề)\\n3) Instructions (Give reasons... Write at least 250 words)",
  "sections": [
    {"id": "intro", "label": "Introduction: [Tóm tắt nội dung mở bài]", "vn": "OUTLINE FORMAT in ${lang}"},
    {"id": "body1", "label": "Body 1: [Luận điểm chính 1]", "vn": "OUTLINE FORMAT in ${lang}"},
    {"id": "body2", "label": "Body 2: [Luận điểm chính 2]", "vn": "OUTLINE FORMAT in ${lang}"},
    {"id": "conclusion", "label": "Conclusion: [Tóm tắt kết luận]", "vn": "OUTLINE FORMAT in ${lang}"}
  ]
}

VÍ DỤ OUTLINE ĐÚNG FORMAT (mỗi section "vn" phải theo format này):
"1 Most global academic materials are in English\\n- Research papers.\\n- Scientific articles.\\n- University textbooks.\\n\\n2 Main language of the Internet\\n- Websites and online platforms.\\n- Educational videos.\\n- International forums.\\n\\n3 Primary language of science and technology\\n- Software documentation.\\n- Conferences and journals.\\n- Global innovations."

VÍ DỤ TITLE ĐÚNG FORMAT:
"In many countries, the gap between the rich and the poor is increasing. Some people believe that this is inevitable in a modern economy, while others think governments should try to reduce it.\\n\\nDiscuss both views and give your opinion.\\n\\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\\n\\nWrite at least 250 words."

RULES BẮT BUỘC:
- title: Statement + Question + Instructions, cách nhau bằng \\n\\n
- label của mỗi section: "[Section name]: [Main idea của section đó]"
- vn của mỗi section phải theo format:
  + Ý chính đánh số (1, 2, 3) - không có dấu )
  + Ý phụ bắt đầu bằng dấu - (gạch ngang)
  + Mỗi ý cách nhau bằng \\n
  + Mỗi nhóm ý chính cách nhau bằng \\n\\n
- Viết ngắn gọn, mỗi ý 3-8 từ
- Ngôn ngữ: ${lang}
- Start with { now:
      `;
    } else {
      // Mode đoạn văn đầy đủ - như hiện tại
      return `
Bạn là chuyên gia thiết kế đề thi. Tạo đề bài essay theo format học thuật cho ${certificateName}, band ${band}.

Format: ${format}

${questionTypes}

QUAN TRỌNG: Chỉ trả về JSON, bắt đầu bằng { và kết thúc bằng }. KHÔNG có text, markdown, hoặc giải thích.

${useEnglish ? `
Cấu trúc JSON bắt buộc (PHẢI có đầy đủ 4 sections với nội dung TIẾNG ANH):
{
  "title": "ĐỀ BÀI GIỐNG ĐỀ THI THẬT, gồm 3 phần cách nhau bằng \\n:\\n1) Statement/Context (2-3 câu tiếng Anh đưa ra bối cảnh, số liệu, quan điểm đối lập)\\n2) Question (câu hỏi theo dạng đề: Discuss both views..., To what extent..., What are the causes...)\\n3) Instructions (Give reasons for your answer and include any relevant examples. Write at least 250 words.)",
  "sections": [
    {
      "id": "intro",
      "label": "Introduction",
      "vn": "INTRODUCTION PARAGRAPH IN ENGLISH: Write a complete English paragraph for the Introduction section. Must include: 1) Opening sentence introducing the topic, 2) Background/context, 3) Thesis statement (main position). Length 100-150 words. MUST be written as a complete, natural paragraph, not bullet points."
    },
    {
      "id": "body1",
      "label": "Body Paragraph 1",
      "vn": "BODY PARAGRAPH 1 IN ENGLISH: Write a complete English paragraph for the first argument. Must include: 1) Topic sentence, 2) Explanation and analysis, 3) Specific example, 4) Concluding sentence. Length 120-180 words. MUST be written as a complete, natural paragraph."
    },
    {
      "id": "body2",
      "label": "Body Paragraph 2",
      "vn": "BODY PARAGRAPH 2 IN ENGLISH: Write a complete English paragraph for the second argument (or counterargument). Must include: 1) Topic sentence, 2) Explanation and analysis, 3) Specific example, 4) Concluding sentence. Length 120-180 words. MUST be written as a complete, natural paragraph."
    },
    {
      "id": "conclusion",
      "label": "Conclusion",
      "vn": "CONCLUSION PARAGRAPH IN ENGLISH: Write a complete English paragraph for the Conclusion section. Must include: 1) Summary of main arguments, 2) Restate position, 3) Final thought or recommendation. Length 80-120 words. MUST be written as a complete, natural paragraph."
    }
  ],
  "instructions": "Hướng dẫn ngắn gọn (tùy chọn)"
}

YÊU CẦU BẮT BUỘC:
- title PHẢI GIỐNG ĐỀ THI THẬT: có Statement + Question + Instructions, cách nhau bằng \\n
- VÍ DỤ TITLE ĐÚNG: "The internet has transformed the way information is shared and consumed. While some view this as a positive development, others are concerned about its impact on traditional media and reliable journalism.\\n\\nDiscuss both views and give your own opinion.\\n\\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\\n\\nWrite at least 250 words."
- Mỗi section PHẢI là một đoạn văn TIẾNG ANH hoàn chỉnh, mạch lạc, tự nhiên
- KHÔNG được viết dạng bullet points hay list
- Nội dung phù hợp với trình độ ${band} của ${certificateName}
` : `
Cấu trúc JSON bắt buộc (PHẢI có đầy đủ 4 sections với nội dung TIẾNG VIỆT):
{
  "title": "ĐỀ BÀI GIỐNG ĐỀ THI THẬT, gồm 3 phần cách nhau bằng \\n:\\n1) Statement/Context (2-3 câu tiếng Anh đưa ra bối cảnh, số liệu, quan điểm đối lập)\\n2) Question (câu hỏi theo dạng đề)\\n3) Instructions (Give reasons... Write at least 250 words.)",
  "sections": [
    {
      "id": "intro",
      "label": "Introduction",
      "vn": "PHẦN MỞ BÀI: Viết đoạn văn tiếng Việt hoàn chỉnh cho phần Introduction. Phải có: 1) Câu mở đầu giới thiệu chủ đề, 2) Background/context, 3) Thesis statement (quan điểm chính). Độ dài 100-150 từ. PHẢI viết như một đoạn văn hoàn chỉnh, tự nhiên, không phải dạng bullet points."
    },
    {
      "id": "body1",
      "label": "Body Paragraph 1",
      "vn": "THÂN BÀI 1: Viết đoạn văn tiếng Việt hoàn chỉnh cho luận điểm đầu tiên. Phải có: 1) Topic sentence (câu chủ đề), 2) Giải thích và phân tích, 3) Ví dụ cụ thể, 4) Câu kết đoạn. Độ dài 120-180 từ. PHẢI viết như một đoạn văn hoàn chỉnh, tự nhiên."
    },
    {
      "id": "body2",
      "label": "Body Paragraph 2",
      "vn": "THÂN BÀI 2: Viết đoạn văn tiếng Việt hoàn chỉnh cho luận điểm thứ hai (hoặc phản biện). Phải có: 1) Topic sentence, 2) Giải thích và phân tích, 3) Ví dụ cụ thể, 4) Câu kết đoạn. Độ dài 120-180 từ. PHẢI viết như một đoạn văn hoàn chỉnh, tự nhiên."
    },
    {
      "id": "conclusion",
      "label": "Conclusion",
      "vn": "PHẦN KẾT LUẬN: Viết đoạn văn tiếng Việt hoàn chỉnh cho phần Conclusion. Phải có: 1) Tóm tắt các luận điểm chính, 2) Nhắc lại quan điểm, 3) Đưa ra kết luận hoặc khuyến nghị. Độ dài 80-120 từ. PHẢI viết như một đoạn văn hoàn chỉnh, tự nhiên."
    }
  ],
  "instructions": "Hướng dẫn ngắn gọn (tùy chọn)"
}

YÊU CẦU BẮT BUỘC:
- title PHẢI GIỐNG ĐỀ THI THẬT: có Statement + Question + Instructions, cách nhau bằng \\n
- VÍ DỤ TITLE ĐÚNG: "Many people believe that social media has had a negative impact on both individuals and society. However, others argue that it has brought significant benefits.\\n\\nTo what extent do you agree or disagree with the statement that social media is harmful?\\n\\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\\n\\nWrite at least 250 words."
- Mỗi section PHẢI là một đoạn văn tiếng Việt hoàn chỉnh, mạch lạc, tự nhiên
- KHÔNG được viết dạng bullet points hay list
`}

BẮT ĐẦU NGAY BÂY GIỜ VỚI DẤU { (không có text nào trước đó):
      `;
    }
  }
};
