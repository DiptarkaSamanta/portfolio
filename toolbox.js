// ----------------------------------------------------
// Aethelgard City Toolbox & Music Player Engine
// ----------------------------------------------------

// Global Environment Simulation States
window.currentTheme = localStorage.getItem('currentTheme') || 'day';
window.controlMode = localStorage.getItem('controlMode') || 'auto';
window.weatherType = localStorage.getItem('activeWeather') || 'clear';

const weatherTempOffsets = {
  clear: 2,
  cloudy: -1,
  rain: -3,
  thunderstorm: -4,
  fog: -5,
  snow: -12
};

const themeBaseTemps = {
  day: 24,
  sunset: 19,
  night: 12,
  sunrise: 15
};

// Ambient Nature Soundscape Synthesizer (Web Audio API)
var audioCtx = window.audioCtx || null;
var windNoiseNode = null;
var waveNoiseNode = null;
var windFilter = null;
var waveFilter = null;
var windGain = null;
var waveGain = null;
var waveLfo = null;
var waveLfoGain = null;
var audioPlaying = false;

function initAudio() {
  if (audioCtx) return;

  try {
    // Standard AudioContext initialization
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Create White Noise Buffer
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    // --- Wind Synth ---
    const windNoise = audioCtx.createBufferSource();
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;

    windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 4.0; // High Q gives resonance
    windFilter.frequency.value = 350; // Initial center frequency

    windGain = audioCtx.createGain();
    windGain.gain.value = 0.05; // Soft volume

    // Connect Wind: Noise -> Filter -> Gain -> Destination
    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(audioCtx.destination);
    windNoise.start(0);
    windNoiseNode = windNoise;

    // --- Waves Synth ---
    const waveNoise = audioCtx.createBufferSource();
    waveNoise.buffer = noiseBuffer;
    waveNoise.loop = true;

    waveFilter = audioCtx.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.value = 180;

    waveGain = audioCtx.createGain();
    waveGain.gain.value = 0.0; // Modulated by LFO

    // Connect Waves: Noise -> Filter -> Gain -> Destination
    waveNoise.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(audioCtx.destination);
    waveNoise.start(0);
    waveNoiseNode = waveNoise;

    // --- LFO to Modulate Waves (Crashing Waves) ---
    waveLfo = audioCtx.createOscillator();
    waveLfo.type = 'sine';
    waveLfo.frequency.value = 0.12; // Wave period around 8 seconds (0.125 Hz)

    waveLfoGain = audioCtx.createGain();
    waveLfoGain.gain.value = 0.18; // Wave depth

    // Connect LFO: LFO -> LFO-Gain -> Wave-Gain
    // Waves surge up and down
    waveLfo.connect(waveLfoGain);
    waveLfoGain.connect(waveGain.gain);
    waveLfo.start(0);

    // Modulation loop for wind gusting
    modulateWindGusts();
  } catch (err) {
    console.error("Audio Context initialization failed:", err);
    audioCtx = null;
  }
}

function modulateWindGusts() {
  if (!audioPlaying || !audioCtx) return;

  let duration = 4; // default fallback duration
  try {
    const now = audioCtx.currentTime;
    // Sweep wind filter frequency randomly to simulate gusting
    const targetFreq = 200 + Math.random() * 500;
    const targetVolume = 0.02 + Math.random() * 0.08;
    duration = 2 + Math.random() * 4; // gust duration

    if (windFilter && windFilter.frequency) {
      windFilter.frequency.exponentialRampToValueAtTime(targetFreq, now + duration);
    }
    if (windGain && windGain.gain) {
      windGain.gain.linearRampToValueAtTime(targetVolume, now + duration);
    }
  } catch (err) {
    console.warn("Failed to modulate wind gusts:", err);
  }

  setTimeout(modulateWindGusts, duration * 1000);
}

function modulateSynthForTheme(time) {
  if (!audioCtx || !audioPlaying) return;

  try {
    const now = audioCtx.currentTime;

    // Schedule starting values to avoid DOMExceptions
    if (waveLfo && waveLfo.frequency) {
      waveLfo.frequency.cancelScheduledValues(now);
      waveLfo.frequency.setValueAtTime(waveLfo.frequency.value, now);
    }
    if (waveLfoGain && waveLfoGain.gain) {
      waveLfoGain.gain.cancelScheduledValues(now);
      waveLfoGain.gain.setValueAtTime(waveLfoGain.gain.value, now);
    }

    if (time === 'night') {
      // Night: Calm, slow deep waves, lighter wind
      if (waveLfo && waveLfo.frequency) waveLfo.frequency.linearRampToValueAtTime(0.08, now + 3);
      if (waveLfoGain && waveLfoGain.gain) waveLfoGain.gain.linearRampToValueAtTime(0.12, now + 3);
    } else if (time === 'sunset') {
      // Sunset: Cozy, mid-range waves
      if (waveLfo && waveLfo.frequency) waveLfo.frequency.linearRampToValueAtTime(0.12, now + 3);
      if (waveLfoGain && waveLfoGain.gain) waveLfoGain.gain.linearRampToValueAtTime(0.16, now + 3);
    } else if (time === 'sunrise') {
      // Sunrise: Gentle breeze rising
      if (waveLfo && waveLfo.frequency) waveLfo.frequency.linearRampToValueAtTime(0.14, now + 3);
      if (waveLfoGain && waveLfoGain.gain) waveLfoGain.gain.linearRampToValueAtTime(0.14, now + 3);
    } else {
      // Day: Active wind, normal wave cycles
      if (waveLfo && waveLfo.frequency) waveLfo.frequency.linearRampToValueAtTime(0.15, now + 3);
      if (waveLfoGain && waveLfoGain.gain) waveLfoGain.gain.linearRampToValueAtTime(0.20, now + 3);
    }
  } catch (err) {
    console.error("Failed to modulate audio parameters for theme:", err);
  }
}

let isMuted = localStorage.getItem('isMuted') === 'true';

function toggleAmbientSound(e) {
  if (e) e.stopPropagation();
  isMuted = !isMuted;
  localStorage.setItem('isMuted', isMuted ? 'true' : 'false');
  applyMuteState();
  if (isMuted) {
    pauseMusicSynth();
  } else {
    playMusicSynth();
  }
}

function applyMuteState() {
  audioPlayer.muted = isMuted;

  if (isMuted) {
    if (audioCtx) {
      audioCtx.suspend().catch(() => {});
    }
    audioPlaying = false;
  } else {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    if (!windNoiseNode) {
      initAudio();
    }
    audioPlaying = true;
    modulateWindGusts();
    if (typeof window.currentTheme !== 'undefined') {
      modulateSynthForTheme(window.currentTheme);
    }
  }

  updateMusicUIState();
}

// Environment Controllers
function setControlMode(mode) {
  window.controlMode = mode;
  localStorage.setItem('controlMode', mode);

  const autoBtn = document.getElementById('btn-mode-auto');
  const modeText = document.getElementById('controlModeText');
  if (autoBtn) {
    if (mode === 'auto') {
      autoBtn.classList.add('active');
      if (modeText) modeText.textContent = 'Auto';
    } else {
      autoBtn.classList.remove('active');
      if (modeText) modeText.textContent = 'Manual';
    }
  }

  if (mode === 'auto') {
    autoAdjustTimeOfDay();
  }
}

function toggleControlMode(e) {
  if (e) e.stopPropagation();
  const nextMode = window.controlMode === 'auto' ? 'manual' : 'auto';
  setControlMode(nextMode);
}

function autoAdjustTimeOfDay() {
  if (window.controlMode !== 'auto') return;

  const sunriseTime = localStorage.getItem('sunriseTime');
  const sunsetTime = localStorage.getItem('sunsetTime');

  if (!sunriseTime || !sunsetTime) {
    autoAdjustTimeOfDayDefault();
    return;
  }

  const nowMs = new Date().getTime();
  const sunriseMs = parseFloat(sunriseTime);
  const sunsetMs = parseFloat(sunsetTime);

  // Define dawn as 1 hour before sunrise to 1 hour after sunrise
  const dawnStart = sunriseMs - 60 * 60 * 1000;
  const dawnEnd = sunriseMs + 60 * 60 * 1000;

  // Define dusk as 1 hour before sunset to 1 hour after sunset
  const duskStart = sunsetMs - 60 * 60 * 1000;
  const duskEnd = sunsetMs + 60 * 60 * 1000;

  let target = 'day';
  if (nowMs >= dawnStart && nowMs <= dawnEnd) {
    target = 'sunrise'; // Dawn
  } else if (nowMs > dawnEnd && nowMs < duskStart) {
    target = 'day'; // Day
  } else if (nowMs >= duskStart && nowMs <= duskEnd) {
    target = 'sunset'; // Dusk
  } else {
    target = 'night'; // Night
  }

  switchTimeOfDay(target);
}

function autoAdjustTimeOfDayDefault() {
  if (window.controlMode !== 'auto') return;
  const hour = new Date().getHours();
  let target = 'day';

  if (hour >= 5 && hour < 7) {
    target = 'sunrise'; // Dawn
  } else if (hour >= 7 && hour < 17) {
    target = 'day'; // Day
  } else if (hour >= 17 && hour < 19.5) {
    target = 'sunset'; // Sunset
  } else {
    target = 'night'; // Night
  }

  switchTimeOfDay(target);
}

function selectTimeManual(time) {
  setControlMode('manual');
  switchTimeOfDay(time);
}

function switchTimeOfDay(time) {
  if (time === 'dawn') time = 'sunrise';
  if (time === 'dusk') time = 'sunset';
  window.currentTheme = time;
  localStorage.setItem('currentTheme', time);

  // Update Buttons
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`btn-${time}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update Theme Class on Body
  const body = document.body;
  if (body) {
    body.classList.remove('theme-day', 'theme-sunset', 'theme-night', 'theme-sunrise');
    const themeClasses = {
      day: 'theme-day',
      sunset: 'theme-sunset',
      night: 'theme-night',
      sunrise: 'theme-sunrise'
    };
    body.classList.add(themeClasses[time] || 'theme-day');
  }

  // Update dynamic weather temperature based on theme change
  updateTemperature();

  // Update bottom time of day display text & icon
  const bottomText = document.getElementById('bottomTimeText');
  const bottomIcon = document.getElementById('bottomTimeIcon');
  if (bottomText) {
    const formattedLabel = time === 'sunrise' ? 'Dawn' : (time === 'sunset' ? 'Dusk' : time.charAt(0).toUpperCase() + time.slice(1));
    bottomText.textContent = formattedLabel;
  }
  if (bottomIcon) {
    if (time === 'day') {
      bottomIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    } else if (time === 'sunset') {
      bottomIcon.innerHTML = '<path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.22 10.22l4.95 4.95M19.78 10.22l-4.95 4.95"></path>';
    } else if (time === 'sunrise') {
      bottomIcon.innerHTML = '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>';
    } else {
      bottomIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
  }

  // Modulate wind/wave synth speeds if sound is playing
  modulateSynthForTheme(time);

  // Hook for map-specific visuals (if app.js is loaded)
  if (typeof window.onThemeChangedMap === 'function') {
    window.onThemeChangedMap(time);
  }
}

function updateTemperature() {
  const baseTemp = themeBaseTemps[window.currentTheme] || 20;
  const offset = weatherTempOffsets[window.weatherType] || 0;
  const tempValue = baseTemp + offset;

  const textEl = document.getElementById('currentWeatherText');
  const minTempEl = document.getElementById('minimizedTemp');
  if (textEl) textEl.textContent = `${tempValue}°C`;
  if (minTempEl) minTempEl.textContent = `${tempValue}°C`;

  // Update minimized icon based on weatherType
  const minIcon = document.getElementById('minimizedWeatherIcon');
  const mainIcon = document.getElementById('currentWeatherIcon');

  let iconSvg = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'; // clear

  if (window.weatherType === 'rain') {
    iconSvg = '<path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path><line x1="8" y1="16" x2="6" y2="22"></line><line x1="12" y1="16" x2="10" y2="22"></line><line x1="16" y1="16" x2="14" y2="22"></line>';
  } else if (window.weatherType === 'snow') {
    iconSvg = '<line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="12" x2="4.93" y2="4.93"></line><line x1="12" y1="12" x2="19.07" y2="19.07"></line><line x1="12" y1="12" x2="4.93" y2="19.07"></line><line x1="12" y1="12" x2="19.07" y2="4.93"></line>';
  } else if (window.weatherType === 'thunderstorm') {
    iconSvg = '<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 8.58"></path><polyline points="13 11 9 17 12 17 11 23 15 15 12 15 13 11"></polyline>';
  } else if (window.weatherType === 'fog') {
    iconSvg = '<line x1="8" y1="10" x2="16" y2="10"></line><line x1="6" y1="14" x2="18" y2="14"></line><line x1="7" y1="18" x2="15" y2="18"></line><path d="M20 10.5a4.5 4.5 0 0 0-4-4.5h-1.26A6.5 6.5 0 1 0 4.5 13c0 2.25 1.5 3.5 3.5 3.5"></path>';
  } else if (window.weatherType === 'cloudy') {
    iconSvg = '<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path>';
  }

  if (minIcon) minIcon.innerHTML = iconSvg;
  if (mainIcon) mainIcon.innerHTML = iconSvg;
}

function setWeather(type) {
  window.weatherType = type;
  localStorage.setItem('activeWeather', type);

  // Update Buttons
  document.querySelectorAll('.weather-grid button').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`weather-${type}`);
  if (activeBtn) activeBtn.classList.add('active');

  updateTemperature();

  // Hook for map-specific weather (if app.js is loaded)
  if (typeof window.onWeatherChangedMap === 'function') {
    window.onWeatherChangedMap(type);
  }
}

function syncGPS(e) {
  if (e) e.stopPropagation();
  const icon = document.getElementById('gpsIcon');
  const locName = document.getElementById('weatherLocationName');
  const gpsBtn = document.getElementById('gpsBtn');

  if (icon) icon.classList.add('spinning');
  if (locName) locName.textContent = "Locating...";
  if (gpsBtn) gpsBtn.disabled = true;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (icon) icon.classList.remove('spinning');
        if (gpsBtn) gpsBtn.disabled = false;

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        const nameText = `My Location [${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lng).toFixed(1)}°${lngDir}]`;

        localStorage.setItem('userLat', lat.toString());
        localStorage.setItem('userLng', lng.toString());
        localStorage.setItem('userLocName', nameText);
        localStorage.setItem('geolocationGranted', 'true');
        localStorage.removeItem('geolocationDenied');

        if (locName) {
          locName.textContent = nameText;
        }

        fetchSunriseSunset(lat, lng);
      },
      (error) => {
        if (icon) icon.classList.remove('spinning');
        if (gpsBtn) gpsBtn.disabled = false;
        if (locName) locName.textContent = "Location Denied";
        localStorage.setItem('geolocationDenied', 'true');
        console.error(error);
      }
    );
  } else {
    if (icon) icon.classList.remove('spinning');
    if (gpsBtn) gpsBtn.disabled = false;
    if (locName) locName.textContent = "Unsupported Browser";
  }
}

// Clock & Calendar Update Loop
function updateClock() {
  const clockEl = document.getElementById('clock');
  const minClockEl = document.getElementById('minimizedClock');
  const dateEl = document.getElementById('calendarDate');
  const now = new Date();

  // Clock
  let hours = now.getHours();
  let minutes = now.getMinutes();
  let seconds = now.getSeconds();
  let ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const displayHours = hours < 10 ? '0' + hours : hours;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  seconds = seconds < 10 ? '0' + seconds : seconds;
  const timeStr = `${displayHours}:${minutes}:${seconds} ${ampm}`;
  if (clockEl) clockEl.textContent = timeStr;
  if (minClockEl) minClockEl.textContent = timeStr;

  // Date
  if (dateEl) {
    const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    dateEl.textContent = `${daysShort[now.getDay()]} ${now.getDate()} ${monthsShort[now.getMonth()]}`;
  }

  // Automatically adjust time of day if in auto mode
  autoAdjustTimeOfDay();

  // Update Neumorphic Analog Clock if present on page
  let hh = document.getElementById('analog-hh');
  let mm = document.getElementById('analog-mm');
  let ss = document.getElementById('analog-ss');

  if (hh && mm && ss) {
    let sec_dot = document.querySelector('.mini-clock-section .sec_dot');
    let min_dot = document.querySelector('.mini-clock-section .min_dot');
    let hr_dot = document.querySelector('.mini-clock-section .hr_dot');

    let hoursEl = document.getElementById('analog-hours');
    let minutesEl = document.getElementById('analog-minutes');
    let secondsEl = document.getElementById('analog-seconds');
    let ampmEl = document.getElementById('analog-ampm');

    let h = now.getHours();
    let m = now.getMinutes();
    let s = now.getSeconds();

    let am = h >= 12 ? "PM" : "AM";
    if (h > 12) {
      h = h - 12;
    }
    h = h === 0 ? 12 : h;

    let hStr = (h < 10) ? "0" + h : h;
    let mStr = (m < 10) ? "0" + m : m;
    let sStr = (s < 10) ? "0" + s : s;

    if (hoursEl) hoursEl.textContent = hStr;
    if (minutesEl) minutesEl.textContent = mStr;
    if (secondsEl) secondsEl.textContent = sStr;
    if (ampmEl) ampmEl.textContent = am;

    // Radius circumference calculation:
    // H: radius = 50. Circumference = 314.1
    // M: radius = 70. Circumference = 439.8
    // S: radius = 90. Circumference = 565.4
    // Smooth values
    let smoothSec = s;
    let smoothMin = m + smoothSec / 60;
    let smoothHour = h + smoothMin / 60;

    // Progress rings
    hh.style.strokeDashoffset = 314 - (314 * smoothHour) / 12;
    mm.style.strokeDashoffset = 440 - (440 * smoothMin) / 60;
    ss.style.strokeDashoffset = 565 - (565 * smoothSec) / 60;

    // Moving dots
    if (sec_dot)
      sec_dot.style.transform = `rotate(${smoothSec * 6}deg)`;

    if (min_dot)
      min_dot.style.transform = `rotate(${smoothMin * 6}deg)`;

    if (hr_dot)
      hr_dot.style.transform = `rotate(${smoothHour * 30}deg)`;
  }
}

// Collapse / Expand Toolbox
function toggleToolboxCollapse(e) {
  if (e) {
    e.stopPropagation();
  }
  const toolboxEl = document.getElementById('mainToolbox');
  if (toolboxEl) {
    toolboxEl.classList.toggle('collapsed');
    localStorage.setItem('toolboxCollapsed', toolboxEl.classList.contains('collapsed'));
  }

  // Re-clamp position after size changes
  setTimeout(restoreToolboxPosition, 310);
}

// Draggable Toolbox Logic
var toolboxIsDragging = false;
var toolboxDragStartX = 0;
var toolboxDragStartY = 0;
var toolboxStartX = 0;
var toolboxStartY = 0;

function onDragStart(e) {
  // Disable dragging on mobile layout
  if (window.innerWidth <= 768) return;

  // Ignore clicks on header buttons or inputs
  if (e.target.closest('.header-btn') || e.target.closest('button')) return;

  const toolboxEl = document.getElementById('mainToolbox');
  if (!toolboxEl) return;

  toolboxIsDragging = true;

  // Support touch events
  const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
  const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);

  toolboxDragStartX = clientX;
  toolboxDragStartY = clientY;

  // Get current offsets
  const rect = toolboxEl.getBoundingClientRect();
  toolboxStartX = rect.left;
  toolboxStartY = rect.top;

  toolboxEl.style.position = 'absolute';
  toolboxEl.style.right = 'auto';
  toolboxEl.style.bottom = 'auto';
  toolboxEl.style.left = `${toolboxStartX}px`;
  toolboxEl.style.top = `${toolboxStartY}px`;

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd);
}

function onDragMove(e) {
  if (!toolboxIsDragging) return;

  const toolboxEl = document.getElementById('mainToolbox');
  if (!toolboxEl) return;

  const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
  const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);

  const deltaX = clientX - toolboxDragStartX;
  const deltaY = clientY - toolboxDragStartY;

  let newX = toolboxStartX + deltaX;
  let newY = toolboxStartY + deltaY;

  // Boundary collision check
  const rect = toolboxEl.getBoundingClientRect();
  const margin = 10;

  if (newX < margin) newX = margin;
  if (newX + rect.width > window.innerWidth - margin) {
    newX = window.innerWidth - rect.width - margin;
  }

  if (newY < margin) newY = margin;
  if (newY + rect.height > window.innerHeight - margin) {
    newY = window.innerHeight - rect.height - margin;
  }

  toolboxEl.style.left = `${newX}px`;
  toolboxEl.style.top = `${newY}px`;

  if (e.cancelable) e.preventDefault();
}

function onDragEnd() {
  toolboxIsDragging = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);

  const toolboxEl = document.getElementById('mainToolbox');
  if (!toolboxEl) return;

  // Save position as viewport percentages
  const rect = toolboxEl.getBoundingClientRect();
  const pos = {
    leftPct: rect.left / window.innerWidth,
    topPct: rect.top / window.innerHeight
  };
  localStorage.setItem('toolboxPosition', JSON.stringify(pos));
}

function restoreToolboxPosition() {
  const toolboxEl = document.getElementById('mainToolbox');
  if (!toolboxEl) return;

  if (window.innerWidth <= 768) {
    toolboxEl.style.position = '';
    toolboxEl.style.left = '';
    toolboxEl.style.top = '';
    toolboxEl.style.right = '';
    toolboxEl.style.bottom = '';
    return;
  }

  const saved = localStorage.getItem('toolboxPosition');
  if (saved) {
    try {
      const pos = JSON.parse(saved);
      let left = pos.leftPct * window.innerWidth;
      let top = pos.topPct * window.innerHeight;

      const rect = toolboxEl.getBoundingClientRect();
      const margin = 10;
      const maxLeft = window.innerWidth - rect.width - margin;
      const maxTop = window.innerHeight - rect.height - margin;

      if (left < margin) left = margin;
      if (left > maxLeft) left = maxLeft;
      if (top < margin) top = margin;
      if (top > maxTop) top = maxTop;

      toolboxEl.style.position = 'absolute';
      toolboxEl.style.right = 'auto';
      toolboxEl.style.bottom = 'auto';
      toolboxEl.style.left = `${left}px`;
      toolboxEl.style.top = `${top}px`;
    } catch (e) {
      console.error("Error restoring toolbox position:", e);
    }
  }
}

window.addEventListener('resize', () => {
  restoreToolboxPosition();
});

// Dropdown Switcher Logic
let activeDropdown = null;

function toggleDropdown(type) {
  const panel = document.getElementById('dropdownPanel');
  const contentCal = document.getElementById('contentCalendar');
  const contentWea = document.getElementById('contentWeather');
  const contentMus = document.getElementById('contentMusic');
  const selCal = document.getElementById('selectorCalendar');
  const selWea = document.getElementById('selectorWeather');
  const selMus = document.getElementById('selectorMusic');

  if (!panel) return;

  if (activeDropdown === type) {
    panel.style.display = 'none';
    if (contentCal) contentCal.style.display = 'none';
    if (contentWea) contentWea.style.display = 'none';
    if (contentMus) contentMus.style.display = 'none';
    if (selCal) selCal.classList.remove('active');
    if (selWea) selWea.classList.remove('active');
    if (selMus) selMus.classList.remove('active');
    activeDropdown = null;
  } else {
    panel.style.display = 'block';
    if (selCal) selCal.classList.remove('active');
    if (selWea) selWea.classList.remove('active');
    if (selMus) selMus.classList.remove('active');

    if (type === 'calendar') {
      if (contentCal) contentCal.style.display = 'block';
      if (contentWea) contentWea.style.display = 'none';
      if (contentMus) contentMus.style.display = 'none';
      if (selCal) selCal.classList.add('active');
      renderCalendar();
    } else if (type === 'weather') {
      if (contentCal) contentCal.style.display = 'none';
      if (contentWea) contentWea.style.display = 'block';
      if (contentMus) contentMus.style.display = 'none';
      if (selWea) selWea.classList.add('active');
    } else if (type === 'music') {
      if (contentCal) contentCal.style.display = 'none';
      if (contentWea) contentWea.style.display = 'none';
      if (contentMus) contentMus.style.display = 'block';
      if (selMus) selMus.classList.add('active');
      renderPlaylist();
    }
    activeDropdown = type;
  }

  // Re-clamp bounds since height changed
  setTimeout(restoreToolboxPosition, 10);
}

// Calendar Generator
function renderCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const calendarMonthYear = document.getElementById('calendarMonthYear');
  if (calendarMonthYear) {
    const currentMonthName = now.toLocaleString('en-US', { month: 'long' });
    calendarMonthYear.textContent = `${currentMonthName} ${year}`;
  }

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell empty';
    grid.appendChild(cell);
  }

  const todayDate = now.getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    cell.textContent = d;

    if (d === todayDate) {
      cell.classList.add('today');
    }

    grid.appendChild(cell);
  }
}

function goToToday() {
  renderCalendar();
}

// ----------------------------------------------------
// Soundtrack Synthesizer & Music Player Engine
// ----------------------------------------------------

const songs = [
  {
    id: 'heatwaves',
    title: 'Heat Waves',
    artist: 'Glass Animals',
    file: 'song/Glass_animal_-_Heat_Waves_(mp3.pm).mp3',
    color: '#0ea5e9',
    lyrics: [
      { time: 0, text: "Road shimmers wigglin' the vision..." },
      { time: 7, text: "Heat waves been faking me out..." },
      { time: 13, text: "Late nights in the middle of June..." },
      { time: 19, text: "Sometimes all I think about is you..." },
      { time: 26, text: "Can't make you happier now..." }
    ]
  },
  {
    id: 'skeletonrap',
    title: "I've Got a Bone",
    artist: 'Dan Bull',
    file: 'song/Dan_Bull_-_MINECRAFT_SKELETON_RAP_I_ve_Got_A_Bone_(SkySound7.com).mp3',
    color: '#a855f7',
    lyrics: [
      { time: 0, text: "I've got a bone to pick with you, little human..." },
      { time: 6, text: "Being bones, we don't have guts..." },
      { time: 12, text: "We're just skeletons..." },
      { time: 18, text: "Welcome to the underground..." },
      { time: 24, text: "How was the fall?" }
    ]
  },
  {
    id: 'animals',
    title: 'Animals',
    artist: 'Maroon 5',
    file: 'song/MaroonS_-_Animals_Bass.Prod_Summer_(mp3.pm).mp3',
    color: '#f97316',
    lyrics: [
      { time: 0, text: "Baby, I'm preying on you tonight..." },
      { time: 6, text: "Hunt you down, eat you alive..." },
      { time: 12, text: "Just like animals, animals..." },
      { time: 18, text: "Maybe you think that you can hide..." },
      { time: 24, text: "I can smell your scent for miles..." }
    ]
  }
];

let musicPlaying = false;
let currentSongIndex = 0;
let savedSongIds = [];

// Load custom uploaded songs from localStorage on startup
try {
  const customSongs = JSON.parse(localStorage.getItem('customSongs') || '[]');
  customSongs.forEach(s => {
    if (!songs.some(existing => existing.file === s.file)) {
      songs.push(s);
    }
  });
} catch (e) {
  console.error("Error loading custom songs:", e);
}

// HTML5 Audio Element Setup
const audioPlayer = new Audio();
let audioSourceNode = null;
let musicAnalyserNode = null;
let frequencyDataArray = null;
let animationFrameId = null;

function initMusicPlayer() {
  const saved = localStorage.getItem('savedSongs');
  if (saved) {
    try {
      savedSongIds = JSON.parse(saved);
    } catch (e) {
      savedSongIds = [];
    }
  }

  const lastActiveId = localStorage.getItem('lastActiveSongId');
  if (lastActiveId) {
    const idx = songs.findIndex(s => s.id === lastActiveId);
    if (idx !== -1) {
      currentSongIndex = idx;
    }
  }

  // Load current audio source
  audioPlayer.src = songs[currentSongIndex].file;
  audioPlayer.preload = "auto";

  const savedVolume = localStorage.getItem('musicVolume') || '0.8';
  audioPlayer.volume = parseFloat(savedVolume);
  const volumeSlider = document.getElementById('musicVolumeSlider');
  if (volumeSlider) {
    volumeSlider.value = savedVolume;
  }

  // Restore playback timestamp reliably once metadata is ready
  let timeSynced = false;
  const savedTimeStr = localStorage.getItem('musicCurrentTime');
  const targetTime = savedTimeStr ? parseFloat(savedTimeStr) : 0;

  const syncPlaybackTime = () => {
    if (!timeSynced && !isNaN(targetTime) && targetTime > 0) {
      if (audioPlayer.readyState >= 1) {
        try {
          if (!audioPlayer.duration || targetTime < audioPlayer.duration) {
            audioPlayer.currentTime = targetTime;
          }
          timeSynced = true;
        } catch (e) {
          console.warn("Could not sync currentTime yet:", e);
        }
      }
    } else if (targetTime === 0) {
      timeSynced = true;
    }
  };

  audioPlayer.addEventListener('loadedmetadata', () => {
    syncPlaybackTime();
    updateSeekProgress();
  });

  audioPlayer.addEventListener('canplay', () => {
    syncPlaybackTime();
    updateSeekProgress();
  });

  audioPlayer.addEventListener('ended', () => {
    playNextSong();
  });

  audioPlayer.addEventListener('timeupdate', () => {
    // Only update musicCurrentTime AFTER initial time restore has completed!
    if (timeSynced && audioPlayer.currentTime > 0) {
      localStorage.setItem('musicCurrentTime', audioPlayer.currentTime);
    }
    if (musicPlaying) {
      updateLyricsActive();
    }
    updateSeekProgress();
  });

  updateSongDisplay();
  renderPlaylist();
  applyMuteState();

  // Determine initial play state:
  // First time site ever opened (musicPlaying is null) -> default to TRUE
  const musicPlayingStored = localStorage.getItem('musicPlaying');
  const userPausedStored = localStorage.getItem('userPaused') === 'true';
  const isMutedStored = localStorage.getItem('isMuted') === 'true';

  const shouldPlay = !isMutedStored && !userPausedStored && (musicPlayingStored === null || musicPlayingStored === 'true');

  const startAutoplayOnInteraction = (e) => {
    if (e && e.target && (e.target.closest('#mainToolbox') || e.target.closest('.music-btn'))) {
      return;
    }
    document.removeEventListener('click', startAutoplayOnInteraction);
    document.removeEventListener('keydown', startAutoplayOnInteraction);

    const mutedNow = localStorage.getItem('isMuted') === 'true';
    const pausedNow = localStorage.getItem('userPaused') === 'true';
    const playingStored = localStorage.getItem('musicPlaying');
    const playingNow = !mutedNow && !pausedNow && (playingStored === null || playingStored === 'true');

    if (playingNow && !musicPlaying) {
      playMusicSynth();
    }
  };

  if (shouldPlay) {
    try {
      audioPlayer.play().then(() => {
        musicPlaying = true;
        localStorage.setItem('musicPlaying', 'true');
        localStorage.setItem('userPaused', 'false');
        syncPlaybackTime();
        updateMusicUIState();
        animateVisualizerActive();
      }).catch(() => {
        musicPlaying = false;
        document.addEventListener('click', startAutoplayOnInteraction);
        document.addEventListener('keydown', startAutoplayOnInteraction);
        updateMusicUIState();
      });
    } catch (err) {
      musicPlaying = false;
      document.addEventListener('click', startAutoplayOnInteraction);
      document.addEventListener('keydown', startAutoplayOnInteraction);
      updateMusicUIState();
    }
  } else {
    // Explicitly stay paused if was not playing, paused by user, or is muted
    musicPlaying = false;
    localStorage.setItem('musicPlaying', 'false');
    updateMusicUIState();
  }
}

function setupAudioVisualNodes() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch (err) {
    console.warn("AudioContext setup/resume was blocked by browser:", err);
  }
  audioSourceNode = null;
  musicAnalyserNode = null;
}

function updateSongDisplay() {
  const song = songs[currentSongIndex];
  if (!song) return;

  const titleEl = document.getElementById('musicTitle');
  const artistEl = document.getElementById('musicArtist');
  const statusTextEl = document.getElementById('musicStatusText');
  const vinylCenter = document.querySelector('.vinyl-center');

  if (titleEl) titleEl.textContent = song.title;
  if (artistEl) artistEl.textContent = song.artist;
  if (statusTextEl) statusTextEl.textContent = `Soundtrack: ${song.title}`;
  if (vinylCenter) {
    vinylCenter.style.backgroundColor = song.color;
    vinylCenter.style.boxShadow = `0 0 10px ${song.color}, inset 0 0 4px rgba(0,0,0,0.6)`;
  }

  document.documentElement.style.setProperty('--accent-color', song.color);

  const lyricsTextEl = document.getElementById('lyricsText');
  if (lyricsTextEl && song.lyrics.length > 0) {
    lyricsTextEl.textContent = `"${song.lyrics[0].text}"`;
  }

  const isSaved = savedSongIds.includes(song.id);
  const saveBtn = document.getElementById('saveSongBtn');

  if (saveBtn) {
    if (isSaved) {
      saveBtn.classList.add('saved');
    } else {
      saveBtn.classList.remove('saved');
    }
  }

  document.querySelectorAll('.playlist-item').forEach(item => {
    item.classList.remove('active');
    const playIndicator = item.querySelector('.playlist-play-indicator');
    if (playIndicator) playIndicator.style.display = 'none';
  });

  const activeItem = document.getElementById(`playlist-item-${song.id}`);
  if (activeItem) {
    activeItem.classList.add('active');
    const playIndicator = activeItem.querySelector('.playlist-play-indicator');
    if (playIndicator && musicPlaying) {
      playIndicator.style.display = 'block';
    }
  }

  localStorage.setItem('lastActiveSongId', song.id);
}

function renderPlaylist() {
  const playlistList = document.getElementById('playlistList');
  if (!playlistList) return;

  playlistList.innerHTML = '';
  songs.forEach((song, idx) => {
    const isSaved = savedSongIds.includes(song.id);
    const isActive = idx === currentSongIndex;

    const item = document.createElement('div');
    item.className = `playlist-item ${isActive ? 'active' : ''}`;
    item.id = `playlist-item-${song.id}`;
    item.onclick = () => selectSong(idx);

    item.innerHTML = `
      <div class="playlist-item-left">
        <span class="playlist-item-title">${song.title}</span>
        <span class="playlist-item-artist">by ${song.artist}</span>
      </div>
      <div class="playlist-item-right">
        ${isSaved ? '<span class="playlist-saved-badge">♥</span>' : ''}
        <span class="playlist-play-indicator" style="display: ${isActive && musicPlaying ? 'block' : 'none'};">▶</span>
      </div>
    `;

    playlistList.appendChild(item);
  });
}

function selectSong(index) {
  const wasPlaying = musicPlaying;
  pauseMusicSynth();

  currentSongIndex = index;
  audioPlayer.src = songs[currentSongIndex].file;
  audioPlayer.load();

  updateSongDisplay();
  renderPlaylist();

  if (wasPlaying) {
    playMusicSynth();
  }
}

function toggleMusicPlayback() {
  if (musicPlaying) {
    pauseMusicSynth();
  } else {
    playMusicSynth();
  }
}

function playPrevSong() {
  let prevIdx = currentSongIndex - 1;
  if (prevIdx < 0) prevIdx = songs.length - 1;
  selectSong(prevIdx);
}

function playNextSong() {
  let nextIdx = (currentSongIndex + 1) % songs.length;
  selectSong(nextIdx);
}

function toggleSaveCurrentSong(e) {
  if (e) e.stopPropagation();
  const song = songs[currentSongIndex];
  if (!song) return;

  const idx = savedSongIds.indexOf(song.id);
  if (idx === -1) {
    savedSongIds.push(song.id);
  } else {
    savedSongIds.splice(idx, 1);
  }

  localStorage.setItem('savedSongs', JSON.stringify(savedSongIds));
  updateSongDisplay();
  renderPlaylist();
}

function updateMusicUIState() {
  const isPlaying = musicPlaying && !audioPlayer.paused;

  // Vinyl Record & Visualizer
  const vinyl = document.getElementById('vinylRecord');
  const vis = document.getElementById('visualizer');
  if (vinyl) {
    if (isPlaying) vinyl.classList.add('playing');
    else vinyl.classList.remove('playing');
  }
  if (vis) {
    if (isPlaying) vis.classList.add('active');
    else vis.classList.remove('active');
  }

  // Header Sound Toggle Button (#soundToggle)
  const soundBtn = document.getElementById('soundToggle');
  const soundIcon = document.getElementById('soundIcon');
  const soundPath = soundIcon ? soundIcon.querySelector('path') : null;

  if (soundBtn) {
    if (isMuted) {
      soundBtn.classList.remove('playing');
      soundBtn.title = "Unmute Sound";
      if (soundPath) {
        soundPath.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm1.96-3.87l-1.48 1.48c.33.73.52 1.54.52 2.39 0 2.25-1.28 4.2-3.17 5.16l1.49 1.49C20.52 16.92 22 14.64 22 12c0-1.45-.42-2.8-1.04-3.87zM2.81 2.81L1.39 4.22l4.5 4.5H3v6h4l5 5V3.88l4.87 4.87c-.6.38-1.25.68-1.96.86v2.02c1.25-.26 2.4-.87 3.34-1.72l2.06 2.06 1.41-1.41L2.81 2.81zM10 16.12L7.83 14H5v-4h2.83L10 7.88v8.24z');
      }
    } else if (isPlaying) {
      soundBtn.classList.add('playing');
      soundBtn.title = "Mute Sound";
      if (soundPath) {
        soundPath.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
      }
    } else {
      soundBtn.classList.remove('playing');
      soundBtn.title = "Sound Paused (Click to Mute)";
      if (soundPath) {
        soundPath.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z');
      }
    }
  }

  // Mini Bar Music Icon & Play State Symbol (#miniMusicToggleBtn)
  const miniIcon = document.getElementById('miniMusicIcon');
  if (miniIcon) {
    if (isMuted) {
      miniIcon.textContent = '🔇';
      miniIcon.style.color = 'var(--text-secondary)';
      miniIcon.style.filter = '';
    } else if (isPlaying) {
      miniIcon.textContent = '🎵';
      miniIcon.style.color = 'var(--accent-color)';
      miniIcon.style.filter = 'drop-shadow(0 0 5px var(--accent-glow))';
    } else {
      miniIcon.textContent = '🎵';
      miniIcon.style.color = 'var(--text-secondary)';
      miniIcon.style.filter = '';
    }
  }

  const miniPlayState = document.querySelectorAll('.mini-play-state, #musicMiniPlayState');
  miniPlayState.forEach(el => {
    if (isMuted) {
      el.textContent = '';
      el.style.color = 'var(--text-secondary)';
    } else if (isPlaying) {
      el.textContent = '▶';
      el.style.color = 'var(--accent-color)';
    } else {
      el.textContent = '⏸';
      el.style.color = 'var(--text-secondary)';
    }
  });

  // Main Player Play/Pause Button Icon SVG (Inside button)
  const playBtn = document.getElementById('musicPlayBtn');
  const playIcon = document.getElementById('musicPlayIcon');
  if (playIcon) {
    if (isPlaying) {
      playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    } else {
      playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    }
  } else if (playBtn) {
    if (isPlaying) {
      playBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    } else {
      playBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg>';
    }
  }

  if (playBtn) {
    playBtn.title = isPlaying ? "Pause Soundtrack" : "Play Soundtrack";
  }
  const miniBtn = document.getElementById('miniMusicToggleBtn');
  if (miniBtn) {
    miniBtn.title = isPlaying ? "Pause Soundtrack" : "Play Soundtrack";
  }

  // Volume Slider Row Mute Icon (#volumeSvgPath inside music player)
  const volPath = document.getElementById('volumeSvgPath');
  if (volPath) {
    if (isMuted || !isPlaying) {
      volPath.setAttribute('d', 'M11 5L6 9H2v6h4l5 4V5z');
    } else {
      volPath.setAttribute('d', 'M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07');
    }
  }

  // Playlist Active Item Indicators
  const currentSong = songs[currentSongIndex];
  if (currentSong) {
    document.querySelectorAll('.playlist-play-indicator').forEach(ind => {
      ind.style.display = 'none';
    });
    if (isPlaying) {
      const activeItem = document.getElementById(`playlist-item-${currentSong.id}`);
      if (activeItem) {
        const indicator = activeItem.querySelector('.playlist-play-indicator');
        if (indicator) indicator.style.display = 'block';
      }
    }
  }
}

function playMusicSynth() {
  if (isMuted) {
    isMuted = false;
    localStorage.setItem('isMuted', 'false');
    applyMuteState();
  }

  musicPlaying = true;
  localStorage.setItem('musicPlaying', 'true');
  localStorage.setItem('userPaused', 'false');

  // Ensure exact saved timestamp is restored before playing
  const savedTimeStr = localStorage.getItem('musicCurrentTime');
  if (savedTimeStr) {
    const parsed = parseFloat(savedTimeStr);
    if (!isNaN(parsed) && parsed > 0 && (!audioPlayer.currentTime || Math.abs(audioPlayer.currentTime - parsed) > 1)) {
      try {
        audioPlayer.currentTime = parsed;
      } catch (e) {}
    }
  }

  setupAudioVisualNodes();

  try {
    audioPlayer.play().then(() => {
      updateMusicUIState();
      animateVisualizerActive();
    }).catch(err => {
      console.error("Audio playback failed:", err);
      musicPlaying = false;
      localStorage.setItem('musicPlaying', 'false');
      updateMusicUIState();
    });
  } catch (err) {
    console.error("Synchronous audio playback failed:", err);
    musicPlaying = false;
    localStorage.setItem('musicPlaying', 'false');
    updateMusicUIState();
  }
}

function pauseMusicSynth() {
  musicPlaying = false;
  localStorage.setItem('musicPlaying', 'false');
  localStorage.setItem('userPaused', 'true');

  if (audioPlayer.currentTime > 0) {
    localStorage.setItem('musicCurrentTime', audioPlayer.currentTime);
  }

  audioPlayer.pause();

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  updateMusicUIState();
}

function animateVisualizerActive() {
  if (!musicPlaying) return;

  animationFrameId = requestAnimationFrame(animateVisualizerActive);

  if (musicAnalyserNode && frequencyDataArray) {
    musicAnalyserNode.getByteFrequencyData(frequencyDataArray);
    const bars = document.querySelectorAll('.audio-visualizer .bar');
    bars.forEach((bar, index) => {
      const binIdx = Math.min(Math.floor(index * 1.5), frequencyDataArray.length - 1);
      const val = frequencyDataArray[binIdx];
      const height = Math.max(3, Math.floor((val / 255) * 22));
      bar.style.height = `${height}px`;
    });
  } else {
    const bars = document.querySelectorAll('.audio-visualizer .bar');
    bars.forEach((bar) => {
      const height = Math.max(3, Math.floor(Math.random() * 22));
      bar.style.height = `${height}px`;
    });
  }
}

function updateLyricsActive() {
  const song = songs[currentSongIndex];
  if (!song || !song.lyrics) return;

  const lyricsTextEl = document.getElementById('lyricsText');
  if (!lyricsTextEl) return;

  const curTime = audioPlayer.currentTime;
  let activeText = song.lyrics[0].text;

  for (let i = 0; i < song.lyrics.length; i++) {
    if (curTime >= song.lyrics[i].time) {
      activeText = song.lyrics[i].text;
    }
  }

  if (lyricsTextEl.textContent !== `"${activeText}"`) {
    lyricsTextEl.style.opacity = 0.5;
    setTimeout(() => {
      lyricsTextEl.textContent = `"${activeText}"`;
      lyricsTextEl.style.opacity = 1;
    }, 100);
  }
}

function downloadCurrentSong() {
  const song = songs[currentSongIndex];
  if (!song) return;

  const a = document.createElement('a');
  a.href = song.file;
  a.download = `${song.title.replace(/\s+/g, '_')}.mp3`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function initToolbox() {
  // Bind events and restore position dynamically after DOM loads
  const dragHandleEl = document.getElementById('toolboxDragHandle');
  const minimizedTriggerEl = document.getElementById('toolboxMinimizedContent');

  if (dragHandleEl) {
    dragHandleEl.addEventListener('mousedown', onDragStart);
    dragHandleEl.addEventListener('touchstart', onDragStart, { passive: true });
  }
  if (minimizedTriggerEl) {
    minimizedTriggerEl.addEventListener('mousedown', onDragStart);
    minimizedTriggerEl.addEventListener('touchstart', onDragStart, { passive: true });
  }

  // Inject Volume & Seek Rows dynamically under Playback Controls on startup
  const controls = document.querySelectorAll('.music-controls');
  controls.forEach(ctrl => {
    if (!ctrl.nextElementSibling || !ctrl.nextElementSibling.classList.contains('music-volume-row')) {
      const volRow = document.createElement('div');
      volRow.className = 'music-volume-row';
      volRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin: 0 16px 8px 16px;';
      volRow.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="volume-icon" style="width: 16px; height: 16px; color: var(--clock-text); opacity: 0.7; cursor: pointer;" onclick="toggleMusicMute(event)">
          <path id="volumeSvgPath" d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
        <input type="range" id="musicVolumeSlider" min="0" max="1" step="0.01" value="0.8" style="flex: 1; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.1); cursor: pointer;" oninput="adjustMusicVolume(this.value)">
      `;
      ctrl.parentNode.insertBefore(volRow, ctrl.nextSibling);

      const seekRow = document.createElement('div');
      seekRow.className = 'music-seek-row';
      seekRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 16px 12px 16px; font-size: 11px; font-family: monospace; color: var(--clock-text); opacity: 0.8;';
      seekRow.innerHTML = `
        <span id="musicCurrentTimeLabel">0:00</span>
        <input type="range" id="musicSeekSlider" min="0" max="100" step="0.1" value="0" style="flex: 1; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.1); cursor: pointer;" oninput="seekMusicTrack(this.value)">
        <span id="musicDurationLabel">0:00</span>
      `;
      volRow.parentNode.insertBefore(seekRow, volRow.nextSibling);
    }
  });

  // Replace download buttons with upload buttons dynamically on startup
  const downloadBtns = document.querySelectorAll('.control-download');
  downloadBtns.forEach(btn => {
    btn.outerHTML = `
      <button class="music-btn control-upload" onclick="triggerMusicUpload(event)" title="Upload MP3">
        <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;"><polyline points="16 16 12 12 8 16"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3c0 .12.01.24.02.36"></path></svg>
      </button>
    `;
  });

  // Replace minimized horizontal bar indicators with single interactive song icon & play state button
  const miniPlayStateEls = document.querySelectorAll('#musicMiniPlayState');
  miniPlayStateEls.forEach(el => {
    const parent = el.parentElement;
    if (parent) {
      parent.outerHTML = `
        <button id="miniMusicToggleBtn" onclick="toggleMusicPlaybackDirect(event)" style="background: none; border: none; cursor: pointer; padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px; border-radius: 4px; transition: transform 0.2s;" title="Play / Pause Soundtrack">
          <span id="miniMusicIcon" style="font-size: 0.85rem; color: var(--text-secondary); transition: all 0.3s ease;">🎵</span>
          <span id="musicMiniPlayState" class="mini-play-state" style="font-size: 0.75rem; font-family: monospace; font-weight: bold; color: var(--text-secondary);">⏸</span>
        </button>
      `;
    }
  });

  // Inject hidden file input dynamically for uploads
  if (!document.getElementById('musicFileInput')) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'musicFileInput';
    fileInput.accept = 'audio/mp3,audio/mpeg';
    fileInput.style.display = 'none';
    fileInput.onchange = handleMusicUpload;
    document.body.appendChild(fileInput);
  }

  restoreToolboxPosition();

  // Rehydrate Collapsed state
  const isCollapsedSaved = localStorage.getItem('toolboxCollapsed');
  if (isCollapsedSaved !== null) {
    const isCollapsed = isCollapsedSaved === 'true';
    const toolboxEl = document.getElementById('mainToolbox');
    if (toolboxEl) {
      if (isCollapsed) {
        toolboxEl.classList.add('collapsed');
      } else {
        toolboxEl.classList.remove('collapsed');
      }
    }
  }

  // Restore and initialize time/weather states
  const savedControlMode = localStorage.getItem('controlMode') || 'manual';
  setControlMode(savedControlMode);

  const savedTheme = localStorage.getItem('currentTheme') || 'day';
  switchTimeOfDay(savedTheme);

  const savedWeather = localStorage.getItem('activeWeather') || 'clear';
  setWeather(savedWeather);

  // Initialize clock and calendar
  updateClock();
  setInterval(updateClock, 1000);

  // Initialize music player
  initMusicPlayer();

  // Rehydrate clock theme
  const savedClockTheme = localStorage.getItem('clockTheme') || 'light';
  setClockTheme(savedClockTheme);

  // Ensure clockStyleSwirl legacy state is cleared so mini clock stays in original mode
  localStorage.removeItem('clockStyleSwirl');
  const miniSection = document.querySelector('.mini-clock-section');
  if (miniSection) {
    miniSection.classList.remove('clock-style-swirl');
  }

  // Staggered alignments to center compass and clock after animations/loader fade out
  if (typeof alignClockAndCompass === 'function') {
    alignClockAndCompass();
    setTimeout(alignClockAndCompass, 100);
    setTimeout(alignClockAndCompass, 500);
    setTimeout(alignClockAndCompass, 1200);
    setTimeout(alignClockAndCompass, 2000);
  }

  // Request user location automatically on load
  requestUserLocation();
}

// Execute clock update immediately on script load if DOM elements are present
try { updateClock(); } catch (e) {}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initToolbox);
} else {
  initToolbox();
}

// Window beforeunload / pagehide to save exact audio time persistently
window.addEventListener('pagehide', () => {
  if (audioPlayer.currentTime > 0) {
    localStorage.setItem('musicCurrentTime', audioPlayer.currentTime);
  }
  localStorage.setItem('musicPlaying', musicPlaying ? 'true' : 'false');
  if (!musicPlaying) {
    localStorage.setItem('userPaused', 'true');
  }
});
window.addEventListener('beforeunload', () => {
  if (audioPlayer.currentTime > 0) {
    localStorage.setItem('musicCurrentTime', audioPlayer.currentTime);
  }
  localStorage.setItem('musicPlaying', musicPlaying ? 'true' : 'false');
  if (!musicPlaying) {
    localStorage.setItem('userPaused', 'true');
  }
});

// Helper Functions for Music Player Features
function updateMusicVolume(val) {
  audioPlayer.volume = val;
  localStorage.setItem('musicVolume', val);
  document.querySelectorAll('.musicVolumeSlider').forEach(slider => {
    slider.value = val;
  });
}

function toggleMusicMuteDirect(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  toggleAmbientSound(e);
}

function toggleMusicMute(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  toggleAmbientSound(e);
}

function triggerMusicUpload(e) {
  if (e) e.stopPropagation();
  const fileInput = document.getElementById('musicFileInput');
  if (fileInput) fileInput.click();
}

function handleMusicUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('songFile', file);

  const lyricsTextEl = document.getElementById('lyricsText');
  if (lyricsTextEl) lyricsTextEl.textContent = "Uploading song to folder...";

  fetch('/upload', {
    method: 'POST',
    body: formData
  })
    .then(res => {
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    })
    .then(data => {
      if (data.success) {
        if (lyricsTextEl) lyricsTextEl.textContent = `Uploaded: ${data.title}!`;

        const newSong = {
          id: data.filename.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(),
          title: data.title,
          artist: data.artist,
          file: data.file,
          color: '#10b981', // Emerald green color theme for uploaded songs
          lyrics: [
            { time: 0, text: `Listening to ${data.title}...` },
            { time: 10, text: `Synthesized from local song folder.` }
          ]
        };

        // Add to runtime songs array
        songs.push(newSong);

        // Save custom playlist additions to localStorage
        const customSongs = JSON.parse(localStorage.getItem('customSongs') || '[]');
        customSongs.push(newSong);
        localStorage.setItem('customSongs', JSON.stringify(customSongs));

        // Re-render playlist and select the new song
        renderPlaylist();
        selectSong(songs.length - 1);
      }
    })
    .catch(err => {
      console.error(err);
      if (lyricsTextEl) lyricsTextEl.textContent = "Upload failed. Try again.";
    });
}

function toggleMusicPlaybackDirect(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  toggleAmbientSound(e);
}

// Seek Progress & Duration Trackers
function updateSeekProgress() {
  const curTime = audioPlayer.currentTime || 0;
  const duration = audioPlayer.duration || 0;

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const curDisplay = document.getElementById('musicCurrentTimeDisplay');
  const totDisplay = document.getElementById('musicTotalTimeDisplay');
  if (curDisplay) curDisplay.textContent = formatTime(curTime);
  if (totDisplay && duration > 0) totDisplay.textContent = formatTime(duration);

  const sliders = document.querySelectorAll('.musicSeekSlider');
  sliders.forEach(slider => {
    if (duration > 0) {
      slider.value = (curTime / duration) * 100;
    } else {
      slider.value = 0;
    }
  });
}

function seekMusicTrack(percent) {
  const duration = audioPlayer.duration || 0;
  if (duration > 0) {
    const targetTime = (percent / 100) * duration;
    audioPlayer.currentTime = targetTime;
    localStorage.setItem('musicCurrentTime', targetTime);

    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    const curDisplay = document.getElementById('musicCurrentTimeDisplay');
    if (curDisplay) curDisplay.textContent = formatTime(targetTime);
  }
}

// Geolocation & Solar Time Fetcher
function requestUserLocation(isUserInitiated = false) {
  const savedLat = localStorage.getItem('userLat');
  const savedLng = localStorage.getItem('userLng');
  const savedLocName = localStorage.getItem('userLocName');

  if (savedLat && savedLng) {
    const lat = parseFloat(savedLat);
    const lng = parseFloat(savedLng);

    const locName = document.getElementById('weatherLocationName');
    if (locName) {
      locName.textContent = savedLocName || `My Location [${Math.abs(lat).toFixed(1)}°, ${Math.abs(lng).toFixed(1)}°]`;
    }

    fetchSunriseSunset(lat, lng);
    return;
  }

  // If user denied previously and this isn't user-initiated, avoid browser popup
  if (!isUserInitiated && localStorage.getItem('geolocationDenied') === 'true') {
    autoAdjustTimeOfDayDefault();
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        const nameText = `My Location [${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lng).toFixed(1)}°${lngDir}]`;

        localStorage.setItem('userLat', lat.toString());
        localStorage.setItem('userLng', lng.toString());
        localStorage.setItem('userLocName', nameText);
        localStorage.setItem('geolocationGranted', 'true');
        localStorage.removeItem('geolocationDenied');

        const locName = document.getElementById('weatherLocationName');
        if (locName) {
          locName.textContent = nameText;
        }

        fetchSunriseSunset(lat, lng);
      },
      (error) => {
        console.warn("Geolocation denied or unavailable, using system time:", error);
        localStorage.setItem('geolocationDenied', 'true');
        autoAdjustTimeOfDayDefault();
      },
      { timeout: 8000 }
    );
  } else {
    autoAdjustTimeOfDayDefault();
  }
}

function fetchSunriseSunset(lat, lng) {
  fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`)
    .then(res => res.json())
    .then(data => {
      if (data.status === "OK") {
        const sunriseDate = new Date(data.results.sunrise);
        const sunsetDate = new Date(data.results.sunset);

        localStorage.setItem('sunriseTime', sunriseDate.getTime());
        localStorage.setItem('sunsetTime', sunsetDate.getTime());

        autoAdjustTimeOfDay();
      }
    })
    .catch(err => {
      console.error("Failed to fetch sunrise/sunset data:", err);
    });
}

// Clock Interactive Actions (Independent Theme Toggle)
function toggleClockTheme(e) {
  if (e) e.stopPropagation();
  const wrapper = document.getElementById('miniClockWrapper');
  if (wrapper) {
    const isDark = wrapper.classList.contains('clock-theme-dark');
    const targetTheme = isDark ? 'light' : 'dark';
    setClockTheme(targetTheme);
  }
}

function setClockTheme(theme) {
  const wrapper = document.getElementById('miniClockWrapper');
  if (wrapper) {
    if (theme === 'dark') {
      wrapper.classList.remove('clock-theme-light');
      wrapper.classList.add('clock-theme-dark');
    } else {
      wrapper.classList.remove('clock-theme-dark');
      wrapper.classList.add('clock-theme-light');
    }
    localStorage.setItem('clockTheme', theme);
  }
}

// Center clock and compass in the left gap dynamically
function alignClockAndCompass() {
  const mapWrapper = document.getElementById('mapWrapper');
  const clockWrapper = document.getElementById('miniClockWrapper');

  if (mapWrapper && clockWrapper) {
    const mapRect = mapWrapper.getBoundingClientRect();
    const mapLeft = mapRect.left;

    const scale = 0.9;
    const clockWidth = 300 * scale;

    // Centered offset between left screen edge and mapWrapper left edge
    let leftOffset = (mapLeft / 2) - (clockWidth / 2);
    if (leftOffset < 10) leftOffset = 10;

    clockWrapper.style.left = `${leftOffset}px`;

    // Position compass centered horizontally in the same gap
    const compass = document.querySelector('.compass-box');
    if (compass) {
      const compassWidth = 80;
      let compassLeft = (mapLeft / 2) - (compassWidth / 2);
      if (compassLeft < 10) compassLeft = 10;
      compass.style.left = `${compassLeft}px`;
    }
  }
}

// Trigger alignment when window size changes
window.addEventListener('resize', alignClockAndCompass);




