# AI Writing Editor

A Next.js application for practicing English writing with AI-powered feedback using Google Gemini API.

## Features

- 📝 **Essay Writing Practice**: Write essays based on Vietnamese source text
- 🤖 **AI-Powered Feedback**: Get real-time analysis and suggestions after each sentence
- 📚 **Multiple Certificates**: Support for IELTS, TOEIC, TOEFL, Cambridge, PTE
- 💾 **Essay Management**: Save and manage multiple essays with session storage
- 🎯 **Target Band Selection**: Choose your target band/score for personalized topics
- 🔄 **Auto-Save**: Automatically save your work as you type

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API (@google/genai)
- **Icons**: Material Symbols

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Gemini API keys

### Installation

1. Clone the repository:
```bash
git clone git@github.com:CuongBC195/elearning.git
cd elearning
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file:
```env
GEMINI_API_KEY_1=your_api_key_1
GEMINI_API_KEY_2=your_api_key_2
GEMINI_API_KEY_3=your_api_key_3
GEMINI_API_KEY_4=your_api_key_4
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
elearning/
├── app/
│   ├── api/
│   │   ├── analyze/          # API route for essay analysis
│   │   └── generate-topic/   # API route for topic generation
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main page (essay list/editor)
├── components/
│   ├── EssayEditor.tsx       # Main essay editor component
│   ├── EssayList.tsx         # Essay list component
│   └── NewEssayModal.tsx     # Modal for creating new essay
├── constants/
│   ├── certificates.ts       # Certificate configurations
│   └── prompts.ts            # AI prompts for Gemini
├── types/
│   └── index.ts              # TypeScript type definitions
└── ...
```

## Usage

1. **Create New Essay**: Click "New Essay" button, select certificate and target band
2. **Write Essay**: Translate Vietnamese source text to English
3. **Get Feedback**: AI automatically analyzes after each completed sentence
4. **Save & Manage**: Essays are auto-saved and can be accessed from the list
5. **Quit**: Click "Quit" to return to essay list

## API Keys Setup

The application uses multiple Gemini API keys for fallback support:
- Free tier: 20 requests/day per key
- With 4 keys: Up to 80 requests/day total
- Keys are tried in order until one succeeds

Get your API keys from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Deployment

See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed Vercel deployment instructions.

## License

MIT
