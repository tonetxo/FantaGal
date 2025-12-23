# Guía de Publicación: Criosfera Armónica na Play Store

Esta guía contén os pasos técnicos e administrativos necesarios para publicar a aplicación.

## 1. Administrativo: Conta de Desenvolvedor
*   Accede a [Google Play Console](https://play.google.com/console).
*   Crea unha conta (pago único de 25$).
*   Verifica a túa identidade (DNI/Pasaporte).

## 2. Técnico: Preparación do Código
Antes de xerar o paquete final, revisa o seguinte:

### Identificador da App
No ficheiro `android/app/build.gradle`:
*   Asegúrate de que o `applicationId` sexa o definitivo (ex: `com.tonetxo.criosfera`).
*   Revisa `versionCode` (número enteiro, aumenta con cada subida).
*   Revisa `versionName` (ex: "1.0.0").

### Xerar Chave de Sinatura (Keystore)
Executa este comando no terminal para crear a túa "assinatura" dixital:
```bash
keytool -genkey -v -keystore criosfera-release.keystore -alias criosfera_alias -keyalg RSA -keysize 2048 -validity 10000
```
**AVISO:** Gardar o ficheiro `.keystore` e os contrasinais nun lugar seguro. Sen eles, non poderás actualizar a app.

## 3. Compilación do Bundle (.aab)
Usa Android Studio para xerar o arquivo de produción:
1.  Menú **Build** > **Generate Signed Bundle / APK**.
2.  Escolle **Android App Bundle**.
3.  Usa o ficheiro `.keystore` xerado no paso anterior.
4.  O arquivo resultante estará en `android/app/release/app-release.aab`.

## 4. Elementos Visuais e Marketing
Para a ficha da tenda necesitarás:
*   **Icona:** 512x512px (PNG).
*   **Banner (Feature Graphic):** 1024x500px.
*   **Capturas:** Polo menos 2 do móbil (podes facelas co Pixel 8).
*   **Política de Privacidade:** Podes aloxala en GitHub Pages.

## 5. Subida e Revisión
1.  Na consola de Google Play, crea unha **Versión de Produción**.
2.  Sube o ficheiro `.aab`.
3.  Enche o cuestionario de clasificación de contido.
4.  Dálle a "Iniciar lanzamento".
5.  Espera a revisión de Google (24h - 72h).

---
*Xerado o 23 de decembro de 2025*
