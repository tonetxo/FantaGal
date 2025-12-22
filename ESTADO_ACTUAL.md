# Criosfera Armónica & Gearheart Matrix

## Visión do Proxecto
Unha plataforma de síntese sonora experimental para Android que combina a **Web Audio API** con **Intelixencia Artificial (Gemini)** para crear instrumentos virtuais baseados en conceptos físicos e atmosféricos. Toda a interface e a interacción coa IA están localizadas en **galego**.

## Estado Actual (Decembro 2025)

### 1. Arquitectura Base
- **Tecnoloxía:** React 19 + TypeScript + Vite.
- **Plataforma Móbil:** Integración con **Capacitor 6** (compatible con Java 17).
- **Xestión de Audio:** Sistema multi-motor con `SynthManager` que xestiona un `AudioContext` compartido, permitindo cambios de instrumento sen cortes de son.
- **Seguridade:** Configuración de **API Key de Gemini** por parte do usuario, gardada de forma persistente e local mediante `@capacitor/preferences`.

### 2. Instrumentos Implementados

#### **Criosfera (Modulador Atmosférico)**
- **Concepto:** Simulación de resonancia en tubaxes orgánicas baixo os mares de metano de Titán.
- **Son:** Síntese aditiva e subtractiva con predominancia de ruído atmosférico e harmónicos pantasma. Ataques moi lentos para crear texturas tipo *drone*.
- **Control:** Pad XY "latente" con estética orgánica e pulso visual.

#### **Gearheart (Matriz de Ritmo)**
- **Concepto:** Maquinaria steampunk de latón e vapor.
- **Interacción Física:** Secuenciador baseado en **física de engrenaxes**. O usuario arrastra pezas metálicas a un motor central para transmitir movemento e xerar ritmos.
- **Son:** Síntese granular e metálica cun secuenciador por pasos que se activa mediante o acoplamento físico das pezas.

### 3. Integración de IA (Xerador IA)
- **Modelo:** Gemini 3 Flash Preview.
- **Función:** Tradución de descricións poéticas (ex: "tormenta de xeo", "vapor a alta presión") a parámetros técnicos do sintetizador (BPM, resonancia, turbulencia, etc.).
- **Localización:** O sistema está instruído para responder sempre en galego con descricións evocadoras.

## Interface de Usuario (UI)
- **Idioma:** 100% Galego.
- **Estética:** Temas dinámicos que cambian segundo o instrumento (Azul/Laranxa para Criosfera, Cobre/Latón para Gearheart).
- **Layout:** Unificado con cabeceira común e controis laterais escamoteables en móbil.

## Próximos Pasos (Suxestións)
- Engadir novos instrumentos (ex: "Volcán de Plasma" ou "Abismo Espectral").
- Mellorar a polifonía e efectos globais (reverb de convolución máis complexa).
- Posibilidade de exportar os patróns rítmicos de Gearheart a MIDI ou WAV.
