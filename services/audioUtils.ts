/**
 * Utilidades de audio compartidas entre los diferentes engines.
 */

/**
 * Crea una curva de distorsión para un WaveShaperNode.
 * @param amount - Cantidad de distorsión (0 = limpia, valores altos = más saturación)
 * @param samples - Número de muestras en la curva (por defecto 44100)
 */
export function makeDistortionCurve(amount: number, samples: number = 44100): Float32Array<ArrayBuffer> {
    const k = amount;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve as Float32Array<ArrayBuffer>;
}



/**
 * Crea un buffer de impulso para reverb de convolución.
 * @param ctx - AudioContext
 * @param duration - Duración del impulso en segundos
 * @param decayPower - Exponente de decaimiento (mayor = decay más rápido)
 */
export function createReverbImpulse(
    ctx: AudioContext,
    duration: number = 2.0,
    decayPower: number = 2
): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);

    for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            const decay = Math.pow(1 - i / length, decayPower);
            data[i] = (Math.random() * 2 - 1) * decay;
        }
    }
    return impulse;
}

/**
 * Crea un buffer de ruido blanco.
 * @param ctx - AudioContext
 * @param duration - Duración en segundos
 */
export function createNoiseBuffer(ctx: AudioContext, duration: number = 2): AudioBuffer {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

/**
 * Normaliza un AudioBuffer a un nivel de pico especificado.
 * @param buffer - Buffer de audio a normalizar (se modifica in-place)
 * @param targetPeak - Nivel de pico objetivo (0-1, por defecto 0.95 = -0.5dB)
 */
export function normalizeBuffer(buffer: AudioBuffer, targetPeak: number = 0.95): void {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        let maxPeak = 0;
        for (let i = 0; i < data.length; i++) {
            if (Math.abs(data[i]) > maxPeak) maxPeak = Math.abs(data[i]);
        }

        if (maxPeak > 0) {
            const gain = targetPeak / maxPeak;
            for (let i = 0; i < data.length; i++) {
                data[i] *= gain;
            }
        }
    }
}

