/**
 * ============================================================================
 * WEB AUDIO API EMERGENCY FIRE SIREN GENERATOR
 * ============================================================================
 * Menghasilkan audio sirine alarm darurat kebakaran secara sintetis
 * langsung di dalam browser tanpa ketergantungan file MP3 eksternal.
 */

class FireAlarmSiren {
    constructor() {
        this.audioCtx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.lfo = null;
        this.lfoGain = null;
        this.isPlaying = false;
        this.isMuted = false;
        this.isAudioUnlocked = false;
    }

    /**
     * Membuka kunci (unlock) AudioContext browser melalui interaksi klik pengguna.
     */
    unlockAudio() {
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.audioCtx = new AudioContextClass();
            }
        }

        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this.isAudioUnlocked = true;
    }

    /**
     * Memulai bunyi sirine darurat frekuensi ganda (Two-Tone Modulated Emergency Siren)
     */
    start() {
        if (this.isPlaying || this.isMuted) return;

        try {
            if (!this.audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                this.audioCtx = new AudioContextClass();
            }

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const now = this.audioCtx.currentTime;

            // 1. Oscillator Utama (Nada Sirine Dasar ~850 Hz)
            this.oscillator = this.audioCtx.createOscillator();
            this.oscillator.type = 'sawtooth';
            this.oscillator.frequency.setValueAtTime(850, now);

            // 2. LFO (Low Frequency Oscillator) untuk modulasi sirine naik-turun (2.5 Hz)
            this.lfo = this.audioCtx.createOscillator();
            this.lfo.type = 'sine';
            this.lfo.frequency.setValueAtTime(2.5, now);

            this.lfoGain = this.audioCtx.createGain();
            this.lfoGain.gain.setValueAtTime(350, now); // Amplitudo modulasi nada (+- 350 Hz)

            // Sambungkan LFO ke frekuensi oscillator utama
            this.lfo.connect(this.lfoGain);
            this.lfoGain.connect(this.oscillator.frequency);

            // 3. Gain Node untuk kontrol volume
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.setValueAtTime(0.01, now);
            this.gainNode.gain.exponentialRampToValueAtTime(0.35, now + 0.1); // Volume halus

            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);

            this.oscillator.start(now);
            this.lfo.start(now);
            this.isPlaying = true;
        } catch (e) {
            console.warn('[AudioSiren] Gagal memutar sirine (menunggu izin interaksi user):', e);
        }
    }

    /**
     * Menghentikan bunyi sirine secara halus
     */
    stop() {
        if (!this.isPlaying) return;

        try {
            if (this.gainNode && this.audioCtx) {
                const now = this.audioCtx.currentTime;
                this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
                this.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
            }

            setTimeout(() => {
                if (this.oscillator) {
                    try { this.oscillator.stop(); this.oscillator.disconnect(); } catch (err) {}
                    this.oscillator = null;
                }
                if (this.lfo) {
                    try { this.lfo.stop(); this.lfo.disconnect(); } catch (err) {}
                    this.lfo = null;
                }
                this.isPlaying = false;
            }, 160);
        } catch (e) {
            this.isPlaying = false;
        }
    }

    /**
     * Mengatur mute / unmute audio sirine
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted && this.isPlaying) {
            this.stop();
        }
        return this.isMuted;
    }
}

// Inisialisasi instance global
window.alarmSiren = new FireAlarmSiren();
