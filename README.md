
# Criosfera Armónica

*Plataforma de síntese sonora experimental para Android: Onde a física, a crioxenia e a IA converxen.*
</div>

---

## 🌌 Visión do Proxecto

**Criosfera Armónica** é un sintetizador de modelado físico deseñado para simular as propiedades acústicas de xigantescas tubaxes orgánicas somerxidas baixo os océanos de metano crioxénico de Titán. Combina un motor de audio personalizado con xeración de parámetros impulsada por Intelixencia Artificial (Gemini).

A interface e a narrativa do proxecto están integramente localizadas en **galego**, ofrecendo unha experiencia única no ámbito da creación sonora experimental.

## 🚀 Características Principais

*   **Motor de Modelado Físico:** Simulación de frecuencias de resonancia, presión e viscosidade mediante cadeas complexas de osciladores, filtros de banda pasante e reverb de convolución.
*   **Integración con Gemini AI:** Tradución de descricións poéticas e atmosféricas (ex: "tormenta de metano pesada") en parámetros técnicos reais do sintetizador.
*   **UI Atmosférica:** Unha interface de usuario especializada que reflicte o contorno hostil e crioxénico de Titán, con temas dinámicos que se adaptan a cada instrumento.
*   **Seguridade e Privacidade:** Xestión local e segura de API Keys mediante `@capacitor/preferences`.

## 🎹 Instrumentos Implementados

### ❄️ Criosfera (Modulador Atmosférico)
Baseado na resonancia de tubaxes orgánicas subacuáticas. Xera texturas tipo *drone* e "harmónicos pantasma" mediante un pad XY reactivo.

### ⚙️ Gearheart (Matriz de Ritmo)
Inspirado na maquinaria *steampunk*. O usuario interactúa cun secuenciador baseado na física de engrenaxes, arrastrando pezas metálicas para activar ritmos granulares e industriais.

## 🛠️ Stack Tecnolóxico

*   **Core:** React 19 + TypeScript
*   **Build Tool:** Vite
*   **Móbil:** Capacitor 6 (Android)
*   **Audio:** Web Audio API (Motor multi-instancia `SynthManager`)
*   **AI:** `@google/genai` (Gemini 1.5 Flash)
*   **Estilo:** Tailwind CSS

---

## 🏃 Comezo Rápido (Local)

**Requisitos previos:** Node.js instalado.

1.  **Clonar e instalar:**
    ```bash
    npm install
    ```
2.  **Configurar API Key:**
    Crea un ficheiro `.env.local` e engade a túa clave de Gemini:
    ```env
    GEMINI_API_KEY=o_teu_api_key_aquí
    ```
3.  **Executar en modo desenvolvemento:**
    ```bash
    npm run dev
    ```

## 📱 Compilación para Android

Este proxecto utiliza Capacitor para a súa versión móbil.

```bash
# Sincronizar cambios co proxecto Android
npx cap sync
# Abrir en Android Studio
npx cap open android
```

---

<div align="center">
Desenvolvido con ❤️ en Galicia.
</div>
