# FantaGal - Sintetizador Modular Nativo Android

Aplicación de sintetizador modular con audio de baja latencia usando Oboe (C++).

## Arquitectura

```
├── app/src/main/
│   ├── cpp/              # Motor de audio C++ (Oboe)
│   ├── kotlin/           # Lógica de negocio y UI
│   └── res/              # Recursos Android
```

## Engines

- **Criosfera Armónica**: Síntesis física de tubos en océanos de metano criogénico
- *(Próximamente)* Gearheart, Echo Vessel, Vocoder, Breitema

## Build

```bash
./gradlew assembleDebug
```

## Requisitos

- Android Studio Hedgehog o superior
- NDK 26+
- CMake 3.22.1+
- API 24+ (Android 7.0)
