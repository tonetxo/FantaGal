# Criosfera Armónica

## Project Overview

**Criosfera Armónica** is a deep-resonance physical modeling synthesizer designed to simulate the acoustic properties of giant organic pipes submerged under the cryogenic methane oceans of Titan (Saturn's largest moon). It combines a custom Web Audio API engine with AI-driven parameter generation.

### Key Features
*   **Physical Modeling Engine:** Simulates resonant frequencies, pressure, and viscosity using a complex chain of oscillators, filters, and convolution reverb.
*   **AI Integration:** Uses Google's Gemini API to translate natural language prompts (e.g., "heavy methane storm") into synthesizer parameters (`turbulence`, `viscosity`, `pressure`).
*   **Atmospheric UI:** A specialized interface reflecting the harsh, cryogenic environment of Titan.

## Architecture

### Tech Stack
*   **Framework:** React 19 + TypeScript
*   **Build Tool:** Vite
*   **Styling:** Tailwind CSS (inferred)
*   **AI:** `@google/genai` SDK

### Core Components
*   **`services/AudioEngine.ts`:** The heart of the synthesizer. It manages the `AudioContext` and a signal chain that includes:
    *   Sawtooth oscillators with bandpass filters for note generation.
    *   Dynamics Compressor, Convolution Reverb, and Delay for atmospheric effects.
    *   LFOs for modulating turbulence and frequency.
*   **`App.tsx`:** The main controller. It handles user state (pressure, resonance, etc.), manages the UI, and bridges the React state with the imperative `AudioEngine`.
*   **`services/GeminiService.ts`:** Handles communication with the Gemini API to fetch "Titan Conditions" based on user prompts.

## Building and Running

### Prerequisites
*   Node.js
*   A Gemini API Key (set in `.env.local` as `GEMINI_API_KEY`).

### Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Development Conventions

*   **State Management:** React `useState` is used for UI state, while the `AudioEngine` class maintains its own imperative state for audio processing. Updates are synced via `useEffect`.
*   **Audio Logic:** All direct Web Audio API manipulations are encapsulated within `AudioEngine` to keep React components pure.
*   **Naming:** Components use PascalCase (`ControlSlider`), services use CamelCase (`audioEngine`), and constants are UPPER_CASE (`NOTES`).
