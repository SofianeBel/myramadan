import storage from './storage.js'
import { isMobile } from './platform.js'

// Kaaba coordinates
const KAABA_LAT = 21.4225
const KAABA_LON = 39.8262

function toRad(deg) { return deg * Math.PI / 180 }
function toDeg(rad) { return rad * 180 / Math.PI }

/**
 * Calculate great-circle bearing from point to Kaaba
 * @returns {number} bearing in degrees (0-360, 0=North, 90=East)
 */
export function calculateQiblaDirection(lat, lon) {
  const lat1 = toRad(lat)
  const lat2 = toRad(KAABA_LAT)
  const dLon = toRad(KAABA_LON - lon)

  const x = Math.sin(dLon) * Math.cos(lat2)
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

  let bearing = toDeg(Math.atan2(x, y))
  return (bearing + 360) % 360
}

export function getCardinalDirection(bearing) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  const index = Math.round(bearing / 45) % 8
  return dirs[index]
}

function renderCompass(svgEl, angle) {
  const ns = 'http://www.w3.org/2000/svg'
  svgEl.replaceChildren()
  svgEl.setAttribute('viewBox', '0 0 200 200')

  // Outer circle
  const circle = document.createElementNS(ns, 'circle')
  circle.setAttribute('cx', '100')
  circle.setAttribute('cy', '100')
  circle.setAttribute('r', '90')
  circle.setAttribute('fill', 'none')
  circle.setAttribute('stroke', 'var(--clr-glass-border)')
  circle.setAttribute('stroke-width', '2')
  svgEl.appendChild(circle)

  // Inner circle
  const innerCircle = document.createElementNS(ns, 'circle')
  innerCircle.setAttribute('cx', '100')
  innerCircle.setAttribute('cy', '100')
  innerCircle.setAttribute('r', '60')
  innerCircle.setAttribute('fill', 'none')
  innerCircle.setAttribute('stroke', 'var(--clr-glass-border)')
  innerCircle.setAttribute('stroke-width', '1')
  innerCircle.setAttribute('stroke-dasharray', '4 4')
  svgEl.appendChild(innerCircle)

  // Cardinal directions
  const cardinals = [
    { text: 'N', x: 100, y: 18 },
    { text: 'E', x: 185, y: 105 },
    { text: 'S', x: 100, y: 195 },
    { text: 'O', x: 15, y: 105 },
  ]
  cardinals.forEach(c => {
    const t = document.createElementNS(ns, 'text')
    t.setAttribute('x', c.x)
    t.setAttribute('y', c.y)
    t.setAttribute('text-anchor', 'middle')
    t.setAttribute('fill', 'var(--text-muted)')
    t.setAttribute('font-size', '14')
    t.setAttribute('font-family', 'var(--font-main)')
    t.textContent = c.text
    svgEl.appendChild(t)
  })

  // Tick marks every 30 degrees
  for (let i = 0; i < 360; i += 30) {
    const rad = toRad(i - 90)
    const x1 = 100 + 85 * Math.cos(rad)
    const y1 = 100 + 85 * Math.sin(rad)
    const x2 = 100 + 90 * Math.cos(rad)
    const y2 = 100 + 90 * Math.sin(rad)
    const line = document.createElementNS(ns, 'line')
    line.setAttribute('x1', x1)
    line.setAttribute('y1', y1)
    line.setAttribute('x2', x2)
    line.setAttribute('y2', y2)
    line.setAttribute('stroke', 'var(--text-muted)')
    line.setAttribute('stroke-width', '1')
    svgEl.appendChild(line)
  }

  // Qibla direction arrow
  const rad = toRad(angle - 90) // SVG 0deg is at 3 o'clock, we want 0deg at 12 o'clock
  const arrowLen = 75
  const tipX = 100 + arrowLen * Math.cos(rad)
  const tipY = 100 + arrowLen * Math.sin(rad)

  // Arrow line
  const arrow = document.createElementNS(ns, 'line')
  arrow.setAttribute('x1', '100')
  arrow.setAttribute('y1', '100')
  arrow.setAttribute('x2', tipX)
  arrow.setAttribute('y2', tipY)
  arrow.setAttribute('stroke', 'var(--clr-gold)')
  arrow.setAttribute('stroke-width', '3')
  arrow.setAttribute('stroke-linecap', 'round')
  svgEl.appendChild(arrow)

  // Arrow tip (triangle)
  const tipSize = 8
  const perpRad = rad + Math.PI / 2
  const p1x = tipX + tipSize * Math.cos(rad)
  const p1y = tipY + tipSize * Math.sin(rad)
  const p2x = tipX - tipSize * 0.5 * Math.cos(rad) + tipSize * 0.5 * Math.cos(perpRad)
  const p2y = tipY - tipSize * 0.5 * Math.sin(rad) + tipSize * 0.5 * Math.sin(perpRad)
  const p3x = tipX - tipSize * 0.5 * Math.cos(rad) - tipSize * 0.5 * Math.cos(perpRad)
  const p3y = tipY - tipSize * 0.5 * Math.sin(rad) - tipSize * 0.5 * Math.sin(perpRad)

  const polygon = document.createElementNS(ns, 'polygon')
  polygon.setAttribute('points', `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`)
  polygon.setAttribute('fill', 'var(--clr-gold)')
  svgEl.appendChild(polygon)

  // Center dot
  const center = document.createElementNS(ns, 'circle')
  center.setAttribute('cx', '100')
  center.setAttribute('cy', '100')
  center.setAttribute('r', '5')
  center.setAttribute('fill', 'var(--clr-gold)')
  svgEl.appendChild(center)

  // Kaaba icon at tip
  const kaaba = document.createElementNS(ns, 'text')
  const kaabaX = 100 + (arrowLen + 12) * Math.cos(rad)
  const kaabaY = 100 + (arrowLen + 12) * Math.sin(rad)
  kaaba.setAttribute('x', kaabaX)
  kaaba.setAttribute('y', kaabaY)
  kaaba.setAttribute('text-anchor', 'middle')
  kaaba.setAttribute('dominant-baseline', 'central')
  kaaba.setAttribute('font-size', '16')
  kaaba.textContent = '\u{1F54B}'
  svgEl.appendChild(kaaba)
}

/**
 * Start live compass on mobile — rotates SVG based on device heading.
 * The compass rotates so Qibla arrow always points to the real-world Qibla.
 * @param {SVGElement} svgEl - The compass SVG element
 * @param {number} qiblaBearing - Qibla bearing in degrees from North
 */
function startLiveCompass(svgEl, qiblaBearing) {
  let lastAlpha = null

  function handleOrientation(event) {
    let heading = event.alpha // 0-360, device compass heading
    if (heading == null) return

    // On Android, alpha is the compass heading (0 = North)
    // We rotate the entire compass so the Qibla arrow points correctly
    // Rotation = -(heading) to counter-rotate the compass as the phone turns
    // The Qibla arrow is rendered at qiblaBearing from North,
    // so when the compass rotates by -heading, it naturally points right
    const rotation = -heading

    // Smooth out small jitters
    if (lastAlpha !== null && Math.abs(heading - lastAlpha) < 0.5) return
    lastAlpha = heading

    svgEl.style.transform = `rotate(${rotation}deg)`
    svgEl.style.transition = 'transform 0.15s ease-out'
  }

  // Request permission on iOS 13+ (needed for DeviceOrientationEvent)
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(state => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true)
        }
      })
      .catch(() => {})
  } else {
    // Android — works directly
    window.addEventListener('deviceorientation', handleOrientation, true)
  }
}

export function initQibla() {
  const card = document.getElementById('qibla-card')
  const svgEl = document.getElementById('qibla-compass')
  const angleEl = document.getElementById('qibla-angle')
  const directionEl = document.getElementById('qibla-direction')
  const cityEl = document.getElementById('qibla-city')
  const noLocationEl = document.getElementById('qibla-no-location')
  const compassContainer = document.getElementById('qibla-compass-container')

  if (!card) return

  const lat = storage.get('userLat')
  const lon = storage.get('userLon')

  if (!lat || !lon) {
    // No coordinates — show message
    if (compassContainer) compassContainer.classList.add('hidden')
    if (noLocationEl) {
      noLocationEl.classList.remove('hidden')
      const settingsBtn = noLocationEl.querySelector('.qibla-settings-link')
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
          document.getElementById('settings-btn')?.click()
        }, { once: true })
      }
    }
    return
  }

  // Calculate bearing
  const bearing = calculateQiblaDirection(lat, lon)
  const cardinal = getCardinalDirection(bearing)

  // Show compass
  if (compassContainer) compassContainer.classList.remove('hidden')
  if (noLocationEl) noLocationEl.classList.add('hidden')

  if (svgEl) {
    renderCompass(svgEl, bearing)
    // On mobile, start live compass rotation using device gyroscope/magnetometer
    if (isMobile) startLiveCompass(svgEl, bearing)
  }
  if (angleEl) angleEl.textContent = `${Math.round(bearing)}\u00B0`
  if (directionEl) directionEl.textContent = cardinal

  // City name from storage
  const city = storage.get('city') || storage.get('mosqueName') || ''
  if (cityEl) cityEl.textContent = city
}
