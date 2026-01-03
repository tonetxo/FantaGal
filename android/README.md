# Vocoder Gal - Android con C++/Oboe

Aplicación de vocoder para Android con:

- **UI**: Kotlin + Jetpack Compose
- **Audio**: C++ con Oboe (baja latencia)
- **JNI**: Bridge entre Kotlin y C++

## Requisitos

- Android Studio Hedgehog o superior
- Android NDK 25+
- CMake 3.22.1+
- Oboe (se descarga automáticamente via prefab)

## Compilar

1. Abre `/android` en Android Studio
2. Sincroniza Gradle
3. Ejecuta en dispositivo físico (el emulador no soporta audio bien)

## Estructura

```
android/
├── app/src/main/
│   ├── java/.../vocodergal/
│   │   ├── MainActivity.kt
│   │   ├── audio/VocoderBridge.kt
│   │   ├── viewmodel/VocoderViewModel.kt
│   │   └── ui/
│   │       ├── VocoderScreen.kt
│   │       └── components/
│   └── cpp/
│       ├── VocoderEngine.cpp
│       ├── VocoderProcessor.cpp
│       ├── DSPComponents.h
│       └── vocoder_jni.cpp
```
