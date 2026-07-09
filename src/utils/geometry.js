// Wandsysteem definities op basis van keukenvorm en lengtes
export function getWalls(shape, lengths) {
  const walls = [
    {
      id: 'back',
      label: 'Achterwand',
      x1: 0,
      z1: 0,
      x2: -lengths.back,
      z2: 0,
      normalX: 0,
      normalZ: 1,
      angle: 0,
      length: lengths.back
    }
  ]

  if (shape === 'L-shape' || shape === 'U-shape') {
    walls.push({
      id: 'right',
      label: 'Rechterwand',
      x1: 0,
      z1: 0,
      x2: 0,
      z2: lengths.right,
      normalX: -1,
      normalZ: 0,
      angle: -Math.PI / 2,
      length: lengths.right
    })
  }

  if (shape === 'U-shape') {
    walls.push({
      id: 'left',
      label: 'Linkerwand',
      x1: -lengths.back,
      z1: 0,
      x2: -lengths.back,
      z2: lengths.left,
      normalX: 1,
      normalZ: 0,
      angle: Math.PI / 2,
      length: lengths.left
    })
  }

  return walls
}

// Bepaal de positie en rotatie van een kast in 3D op basis van wand en offset
export function getCabinetTransform(cabinet, walls) {
  const wall = walls.find(w => w.id === cabinet.wall)
  if (!wall) return { position: [0, 0, 0], rotation: 0 }

  const depth = cabinet.depth
  const height = cabinet.height
  const offset = cabinet.offset

  // Richtingsvector van de wand
  const dx = (wall.x2 - wall.x1) / wall.length
  const dz = (wall.z2 - wall.z1) / wall.length

  // Startpunt + offset langs de wand
  const lineX = wall.x1 + offset * dx
  const lineZ = wall.z1 + offset * dz

  // Verschuif naar binnen (halve diepte) langs de normaalvector
  const x = lineX + (depth / 2) * wall.normalX
  const z = lineZ + (depth / 2) * wall.normalZ

  // Y-as positie
  let y = 0.5 // base cabinet default (height 0.8 sits on 0.1 plinth -> center Y = 0.5)
  if (cabinet.type === 'tall') {
    y = cabinet.height / 2 + 0.05 // carcass center is at height/2 + 0.05 (sits on 0.1m plinth)
  } else if (cabinet.type.startsWith('wall')) {
    y = 1.65 // floating wall cabinet -> center Y = 1.65 (maintains a 41cm gap above 94cm worktop)
  }

  return {
    position: [x, y, z],
    rotation: wall.angle
  }
}

// Projecteer een 2D punt (x, z) op de dichtstbijzijnde wand en geef de wand en offset terug
export function getClosestWallAndOffset(x, z, walls) {
  let closestWall = null
  let closestOffset = 0
  let minDistance = Infinity

  walls.forEach(wall => {
    const dx = wall.x2 - wall.x1
    const dz = wall.z2 - wall.z1
    const L2 = dx * dx + dz * dz
    if (L2 === 0) return

    // Projectieberekening van punt op lijnsegment
    const t = Math.max(0, Math.min(1, ((x - wall.x1) * dx + (z - wall.z1) * dz) / L2))
    
    // Het dichtstbijzijnde punt op de wandsegment
    const projX = wall.x1 + t * dx
    const projZ = wall.z1 + t * dz

    // Afstand tot het punt
    const dist = Math.sqrt((x - projX) * (x - projX) + (z - projZ) * (z - projZ))

    if (dist < minDistance) {
      minDistance = dist
      closestWall = wall
      closestOffset = t * wall.length
    }
  })

  return {
    wall: closestWall,
    offset: closestOffset,
    distance: minDistance
  }
}

// AutoCAD OSNAP-achtige snapping logica
// Snapt de offset naar wanduiteinden en randen van bestaande kasten
export function getSnappedOffset(
  rawOffset,
  targetWallId,
  cabinets,
  openings,
  cabWidth,
  excludeId = null,
  snapDistance = 0.20 // 20 cm snap bereik
) {
  const wallLength = targetWallId === 'back' ? 4.0 : 4.74 // Fallback, maar we overschrijven dit met actuele lengtes
  
  // Verzamel alle mogelijke snap-punten op deze wand
  const snapPoints = []

  // 1. Snaps naar de uiterste hoeken van de wand
  snapPoints.push({ val: cabWidth / 2, desc: 'Wand begin' })
  // We hebben de actuele wandlengte nodig. We kunnen deze opzoeken uit de actuele wanden.
  // Maar om het algemeen te maken, laten we de wandlengte passeren als argument of uitrekenen via de wandomtrek.

  // Om de wandlengte correct te snappen, bepalen we deze uit de wanden.
  // Laten we de wandlengte meegeven aan de functie!
}

// Verbeterde versie met wallLength parameter
export function getSnappedOffsetWithLength(
  rawOffset,
  targetWallId,
  wallLength,
  cabinets,
  openings,
  cabWidth,
  excludeId = null,
  snapDistance = 0.20,
  isWallCab = false
) {
  const snapPoints = []

  // 1. Snaps naar de uiterste hoeken van de wand (rekening houdend met halve kastbreedte)
  snapPoints.push({ val: cabWidth / 2, desc: 'Wand begin' })
  snapPoints.push({ val: wallLength - cabWidth / 2, desc: 'Wand einde' })

  // 2. Snaps naar zijkanten van bestaande kasten op dezelfde wand en in dezelfde laag (base/wall)
  const isNewWallCab = isWallCab || (excludeId ? (cabinets.find(c => c.id === excludeId)?.type.startsWith('wall') || false) : false)
  
  const sameWallCabs = cabinets.filter(c => 
    c.wall === targetWallId && 
    c.id !== excludeId &&
    (c.type.startsWith('wall') === isNewWallCab) // Alleen snappen aan kasten in dezelfde laag
  )

  sameWallCabs.forEach(c => {
    // Een bestaande kast c bezet de zone [c.offset - c.width/2, c.offset + c.width/2]
    // We kunnen snappen zodat we er links/boven tegenaan sluiten:
    snapPoints.push({ 
      val: c.offset - c.width / 2 - cabWidth / 2, 
      desc: `Aansluiten links van ${c.code}` 
    })
    
    // Of we sluiten er rechts/onder tegenaan:
    snapPoints.push({ 
      val: c.offset + c.width / 2 + cabWidth / 2, 
      desc: `Aansluiten rechts van ${c.code}` 
    })
  })

  // 3. Snaps voor hoekkasten op aangrenzende muren (zowel onderkasten als bovenkasten)
  cabinets.forEach(c => {
    if (c.id !== excludeId) {
      if (!isNewWallCab && c.type === 'corner_L') {
        // Corner back-right (meeting of back and right walls at offset 0)
        if (
          (c.wall === 'back' && Math.abs(c.offset - 0.45) < 0.05 && targetWallId === 'right') ||
          (c.wall === 'right' && Math.abs(c.offset - 0.45) < 0.05 && targetWallId === 'back')
        ) {
          snapPoints.push({
            val: 0.9 + cabWidth / 2,
            desc: 'Aansluiten op hoekkast (hoek)'
          })
        }
        
        // Corner back-left
        if (c.wall === 'back' && targetWallId === 'left') {
          if (c.offset > 1.5) {
            snapPoints.push({
              val: 0.9 + cabWidth / 2,
              desc: 'Aansluiten op hoekkast (hoek)'
            })
          }
        }
        if (c.wall === 'left' && Math.abs(c.offset - 0.45) < 0.05 && targetWallId === 'back') {
          snapPoints.push({
            val: wallLength - 0.9 - cabWidth / 2,
            desc: 'Aansluiten op hoekkast (hoek)'
          })
        }
      } else if (isNewWallCab && c.type === 'wall_corner_L') {
        // Hoekbovenkast (90x90cm)
        // Corner back-right (meeting of back and right walls at offset 0)
        if (
          (c.wall === 'back' && Math.abs(c.offset - 0.45) < 0.05 && targetWallId === 'right') ||
          (c.wall === 'right' && Math.abs(c.offset - 0.45) < 0.05 && targetWallId === 'back')
        ) {
          snapPoints.push({
            val: 0.9 + cabWidth / 2,
            desc: 'Aansluiten op hoekbovenkast (hoek)'
          })
        }
        
        // Corner back-left
        if (c.wall === 'back' && targetWallId === 'left') {
          if (c.offset > 1.5) {
            snapPoints.push({
              val: 0.9 + cabWidth / 2,
              desc: 'Aansluiten op hoekbovenkast (hoek)'
            })
          }
        }
        if (c.wall === 'left' && Math.abs(c.offset - 0.45) < 0.05 && targetWallId === 'back') {
          snapPoints.push({
            val: wallLength - 0.9 - cabWidth / 2,
            desc: 'Aansluiten op hoekbovenkast (hoek)'
          })
        }
      }
    }
  })

  // Zoek naar de dichtstbijzijnde snap point
  let bestSnap = null
  let minDiff = snapDistance

  snapPoints.forEach(pt => {
    const diff = Math.abs(rawOffset - pt.val)
    if (diff < minDiff) {
      minDiff = diff
      bestSnap = pt
    }
  })

  // Als we een geldige snap vinden, geven we de gesnapte waarde terug, anders de ruwe waarde
  if (bestSnap) {
    // Zorg dat we binnen de wandgrenzen blijven
    return Math.max(cabWidth / 2, Math.min(wallLength - cabWidth / 2, bestSnap.val))
  }

  return Math.max(cabWidth / 2, Math.min(wallLength - cabWidth / 2, rawOffset))
}
