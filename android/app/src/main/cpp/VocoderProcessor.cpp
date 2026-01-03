#include "VocoderProcessor.h"
#include <algorithm>
#include <cmath>

constexpr std::array<float, VocoderProcessor::kNumBands>
    VocoderProcessor::kBandFrequencies;

VocoderProcessor::VocoderProcessor(float sampleRate)
    : mSampleRate(sampleRate), mCarrier(sampleRate), mVibratoLFO(sampleRate),
      mTremoloLFO(sampleRate) {

  // Configurar constantes de tiempo para los suavizadores (~30ms)
  float tc = 30.0f;
  sIntensity.setTimeConstant(tc, sampleRate);
  sNoiseThreshold.setTimeConstant(tc, sampleRate);
  sEchoAmount.setTimeConstant(tc, sampleRate);
  sVibratoAmount.setTimeConstant(tc, sampleRate);
  sTremoloAmount.setTimeConstant(tc, sampleRate);
  sBasePitch.setTimeConstant(tc, sampleRate);

  // Valores iniciales
  sNoiseThreshold.setTarget(0.012f);
  sIntensity.setTarget(1.5f); // Subido de 1.2f
  sBasePitch.setTarget(140.0f);

  mEchoBuffer.resize(kEchoSamples, 0.0f);

  // Vibrato LFO: 5Hz Sine
  mVibratoLFO.setFrequency(5.0f);
  mVibratoLFO.setWaveform(Oscillator::Waveform::Sine);

  // Tremolo LFO: 6Hz Sine
  mTremoloLFO.setFrequency(6.0f);
  mTremoloLFO.setWaveform(Oscillator::Waveform::Sine);

  // Filtro anti-acople (100Hz HPF)
  mModHPF.setCoefficients(100.0f, 0.707f, sampleRate);

  initBands();
}

void VocoderProcessor::initBands() {
  constexpr float Q = 18.0f; // Baixado de 25 a 18 para un son máis suave e
                             // menos propenso a asubíos
  for (int i = 0; i < kNumBands; i++) {
    mBands[i].frequency = kBandFrequencies[i];
    mBands[i].modFilter.setCoefficients(kBandFrequencies[i], Q, mSampleRate);
    mBands[i].carFilter.setCoefficients(kBandFrequencies[i], Q, mSampleRate);
    mBands[i].envelope = EnvelopeFollower(mSampleRate);
  }
}

void VocoderProcessor::process(const float *input, float *output,
                               int numFrames) {
  for (int frame = 0; frame < numFrames; frame++) {
    // Obtener valores suavizados por cada frame
    float currentPitch = sBasePitch.process();
    float currentVibrato = sVibratoAmount.process();
    float currentIntensity = sIntensity.process();
    float currentEcho = sEchoAmount.process();
    float currentTremolo = sTremoloAmount.process();
    float currentThreshold = sNoiseThreshold.process();

    // Aplicar vibrato al pitch
    float vibratoMod = mVibratoLFO.process() * currentVibrato * 20.0f;
    mCarrier.setFrequency(currentPitch + vibratoMod);

    // Generar carrier
    float carrierSample = mCarrier.process();

    // Modulador: Preamplificación (16x balanceado)
    float modSample = input[frame] * 16.0f;

    // Aplicar HPF para quitar retumbo de graves que causa acople
    modSample = mModHPF.process(modSample);

    // Vocoding: Bandas
    float outputSample = 0.0f;
    for (auto &band : mBands) {
      float filteredMod = band.modFilter.process(modSample);
      float envelope = band.envelope.process(filteredMod);

      // Porta de ruído mellorada: usamos un factor de transparencia
      if (envelope > currentThreshold) {
        float filteredCar = band.carFilter.process(carrierSample);
        // Exponenciamos o sobre para dar máis punch sen subir o ruído de fondo
        float boost = (envelope - currentThreshold * 0.5f);
        outputSample += filteredCar * boost * currentIntensity;
      }
    }

    // Normalización base (0.7f para volume presente sen acoplar)
    outputSample *= 0.7f;

    // Aplicar tremolo (modulación de amplitud post-vocoder)
    if (currentTremolo > 0.001f) {
      float tremoloMod =
          1.0f - (mTremoloLFO.process() * 0.5f + 0.5f) * currentTremolo;
      outputSample *= tremoloMod;
    }

    // Aplicar eco
    if (currentEcho > 0.001f) {
      float delayed = mEchoBuffer[mEchoIndex];
      outputSample += delayed * currentEcho;
      mEchoBuffer[mEchoIndex] = outputSample;
      mEchoIndex = (mEchoIndex + 1) % kEchoSamples;
    }

    // Soft-clipper básico (tanhish) para evitar picos abruptos que realimentan
    if (outputSample > 1.0f)
      outputSample = 1.0f;
    if (outputSample < -1.0f)
      outputSample = -1.0f;

    output[frame] = outputSample;
  }
}

void VocoderProcessor::setPitch(float pitch) {
  sBasePitch.setTarget(std::clamp(pitch, 50.0f, 400.0f));
}

void VocoderProcessor::setIntensity(float intensity) {
  sIntensity.setTarget(
      std::clamp(intensity, 0.2f, 4.0f)); // Aumentado o teito de 3.0 a 4.0
}

void VocoderProcessor::setWaveform(int type) {
  mCarrier.setWaveform(static_cast<Oscillator::Waveform>(type));
}

void VocoderProcessor::setVibrato(float amount) {
  sVibratoAmount.setTarget(std::clamp(amount, 0.0f, 1.0f));
}

void VocoderProcessor::setEcho(float amount) {
  sEchoAmount.setTarget(std::clamp(amount, 0.0f, 0.7f));
}

void VocoderProcessor::setTremolo(float amount) {
  sTremoloAmount.setTarget(std::clamp(amount, 0.0f, 1.0f));
}

void VocoderProcessor::setNoiseThreshold(float threshold) {
  sNoiseThreshold.setTarget(std::clamp(threshold, 0.005f, 0.2f));
}
