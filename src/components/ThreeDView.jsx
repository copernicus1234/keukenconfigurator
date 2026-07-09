import { useMemo, Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, ContactShadows, useGLTF, Environment, Text } from '@react-three/drei'
import * as THREE from 'three'
import { getWalls } from '../utils/geometry'

// Een lichtbron die met de camera meebeweegt (headlight)
function CameraLight() {
  const lightRef = useRef()
  useFrame(({ camera }) => {
    if (lightRef.current) {
      lightRef.current.position.copy(camera.position)
    }
  })
  return (
    <pointLight 
      ref={lightRef} 
      intensity={0.20} 
      decay={0}
      distance={0}
      castShadow={false} 
    />
  )
}

// Helper om ter plekke een eikenhout PBR-achtige textuur te genereren
function createWoodTexture(baseColorHex, grainColorHex) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  
  // Achtergrondkleur (basis hout)
  ctx.fillStyle = baseColorHex
  ctx.fillRect(0, 0, 512, 512)
  
  // Fijne houtnerven
  ctx.fillStyle = grainColorHex
  for (let i = 0; i < 180; i++) {
    const y = Math.random() * 512
    const height = 1 + Math.random() * 2
    ctx.globalAlpha = 0.04 + Math.random() * 0.06
    ctx.fillRect(0, y, 512, height)
  }
  
  // Houtvlammen / golven
  for (let j = 0; j < 8; j++) {
    ctx.globalAlpha = 0.02
    ctx.beginPath()
    const waveY = Math.random() * 512
    ctx.moveTo(0, waveY)
    ctx.bezierCurveTo(150, waveY - 30, 350, waveY + 30, 512, waveY)
    ctx.lineWidth = 15 + Math.random() * 25
    ctx.strokeStyle = grainColorHex
    ctx.stroke()
  }

  // Subtiele noesten (knots)
  for (let k = 0; k < 2; k++) {
    ctx.globalAlpha = 0.03
    const knotX = Math.random() * 512
    const knotY = Math.random() * 512
    const grad = ctx.createRadialGradient(knotX, knotY, 2, knotX, knotY, 20 + Math.random() * 30)
    grad.addColorStop(0, grainColorHex)
    grad.addColorStop(0.3, baseColorHex)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(knotX, knotY, 30, 0, Math.PI * 2)
    ctx.fill()
  }
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 4) // Rek de nerf uit in de lengte voor een realistisch paneel
  return texture
}

// Helper om een houten parketvloer textuur te genereren
function createFloorTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  
  // Warme basis houtkleur
  ctx.fillStyle = '#dfc3a3'
  ctx.fillRect(0, 0, 512, 512)
  
  // Teken parketplanken
  ctx.strokeStyle = '#c5a583'
  ctx.lineWidth = 1.5
  const plankWidth = 64
  const plankLength = 256
  
  for (let i = 0; i < 512; i += plankWidth) {
    // Verticale lijnen
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 512)
    ctx.stroke()
    
    // Horizontale naden (staggered)
    const offset = (i / plankWidth) % 2 * 128
    for (let j = offset; j < 512 + 256; j += plankLength) {
      ctx.beginPath()
      ctx.moveTo(i, j % 512)
      ctx.lineTo(i + plankWidth, j % 512)
      ctx.stroke()
    }
  }
  
  // Fijne houtnerven toevoegen voor realisme
  ctx.fillStyle = '#b59573'
  for (let k = 0; k < 1500; k++) {
    ctx.globalAlpha = 0.03
    const rx = Math.random() * 512
    const ry = Math.random() * 512
    const rw = 2 + Math.random() * 60
    const rh = 1
    ctx.fillRect(rx, ry, rw, rh)
  }
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  return texture
}

// Reginox Queen 60 Sink Component (GLTF model)
function ReginoxSink({ metalMaterial }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/R16633_S_SST_CAD_V2202.gltf`)
  const clonedScene = useMemo(() => scene.clone(), [scene])

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.material = metalMaterial
      }
    })
  }, [clonedScene, metalMaterial])

  // GLTF model bounds: X 0→0.595m, Y 0→0.470m, Z 0.005→0.170m (Z-up CAD model)
  // Rotatie [π/2, π, 0]: draai 90° om X en 180° om Y zodat de kraanlandingszijde aan de achterkant (muurzijde) zit.
  // X-offset +0.2975: centreert de breedte op X=0 (want X is nu gespiegeld naar -u)
  // Y-offset -0.169: trekt de spoelbak omlaag zodat de rand 1mm boven het werkblad rust (voorkomt Z-fighting)
  // Z-offset -0.185: verschuift de bak 50mm naar voren (richting kamerzijde, blauwe Z-as) om uit te lijnen met de kraan
  return (
    <primitive
      object={clonedScene}
      rotation={[Math.PI / 2, Math.PI, 0]}
      position={[0.2975, -0.169, -0.185]}
    />
  )
}

// 3D Cabinet Component
function Cabinet3D({ cabinet, isSelected, onSelect, woodMaterial, metalMaterial }) {
  const { width, height, depth, position, type, code } = cabinet

  // Drawer / door front layout per cabinet type
  const renderFronts = () => {
    const gap = 0.004 // 4mm naad tussen lades
    const frontDepth = 0.02 // 2cm dikke fronten

    // Normaliseer catalogus-types naar renderer-types
    const resolvedType =
      type === 'drawers' ? 'base_drawer' :
      type === 'door'    ? 'base_door'   :
      type === 'sink'    ? 'base_sink'   :
      type

    if (code === 'ME104') {
      const baseHeight = height <= 0.85 ? height : 0.8
      const doorW = width - gap
      const doorH = baseHeight - gap
      const gripR = 0.007
      const doorGripLen = doorW * 0.55
      const openAngle = -Math.PI / 4 // 45 graden open
      return (
        <group position={[-width / 2, 0, depth / 2]}>
          <group rotation={[0, openAngle, 0]}>
            {/* Deur front */}
            <mesh position={[doorW / 2, 0, frontDepth / 2]} castShadow receiveShadow>
              <boxGeometry args={[doorW, doorH, frontDepth]} />
              <primitive object={woodMaterial} attach="material" />
            </mesh>
            {/* Horizontale handgreep */}
            <mesh position={[doorW / 2, doorH / 2 - 0.08, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[gripR, gripR, doorGripLen, 8]} />
              <primitive object={metalMaterial} attach="material" />
            </mesh>
          </group>
        </group>
      )
    }

    if (resolvedType === 'tall') {
      // Hoge kast: een onderdeur en een bovendeur
      const lowerDoorH = 0.72
      const upperDoorH = height - lowerDoorH - gap - 0.1 // plinth is 10cm
      const gripLen = width * 0.55
      const carcassHalfH = (height - 0.1) / 2
      return (
        <group position={[0, 0, depth / 2 + frontDepth / 2]}>
          {/* Onderste front */}
          <mesh position={[0, -carcassHalfH + lowerDoorH / 2, 0]}>
            <boxGeometry args={[width - gap, lowerDoorH, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Horizontale greep onderdeur */}
          <mesh position={[0, -carcassHalfH + lowerDoorH - 0.08, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.007, 0.007, gripLen, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>

          {/* Bovenste front */}
          <mesh position={[0, -carcassHalfH + lowerDoorH + gap + upperDoorH / 2, 0]}>
            <boxGeometry args={[width - gap, upperDoorH - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Horizontale greep bovendeur */}
          <mesh position={[0, -carcassHalfH + lowerDoorH + gap + 0.08, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.007, 0.007, gripLen, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>
        </group>
      )
    }

    if (resolvedType === 'wall' || resolvedType === 'wall_extractor') {
      const hasDoubleDoors = width >= 0.8
      const gripLen = (width / (hasDoubleDoors ? 2 : 1)) * 0.5
      return (
        <group position={[0, 0, depth / 2 + frontDepth / 2]}>
          {hasDoubleDoors ? (
            <>
              <mesh position={[-width / 4, 0, 0]}>
                <boxGeometry args={[width / 2 - gap, height - gap, frontDepth]} />
                <primitive object={woodMaterial} attach="material" />
              </mesh>
              <mesh position={[width / 4, 0, 0]}>
                <boxGeometry args={[width / 2 - gap, height - gap, frontDepth]} />
                <primitive object={woodMaterial} attach="material" />
              </mesh>
              {/* Horizontale greepjes bovenkasten (links + rechts) */}
              <mesh position={[-width / 4, -height / 2 + 0.07, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.006, 0.006, gripLen, 8]} />
                <primitive object={metalMaterial} attach="material" />
              </mesh>
              <mesh position={[width / 4, -height / 2 + 0.07, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.006, 0.006, gripLen, 8]} />
                <primitive object={metalMaterial} attach="material" />
              </mesh>
            </>
          ) : (
            <>
              <mesh>
                <boxGeometry args={[width - gap, height - gap, frontDepth]} />
                <primitive object={woodMaterial} attach="material" />
              </mesh>
              {/* Horizontale greep bovenaan de deur */}
              <mesh position={[0, -height / 2 + 0.07, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.006, 0.006, gripLen, 8]} />
                <primitive object={metalMaterial} attach="material" />
              </mesh>
            </>
          )}
          {/* Afzuigkap kap onderkant indien afzuigkast */}
          {resolvedType === 'wall_extractor' && (
            <mesh position={[0, -height / 2 - 0.02, -depth / 4]} castShadow>
              <boxGeometry args={[width, 0.04, depth / 2]} />
              <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.8} />
            </mesh>
          )}
        </group>
      )
    }

    // Hoekonderkast (Corner cabinet)
    if (resolvedType === 'corner_L') {
      const isLeftCorner = cabinet.wall === 'back' ? cabinet.offset <= 1.5 : cabinet.wall === 'left'
      const xSign = isLeftCorner ? -1 : 1
      return (
        <group>
          {/* Door 1 (facing forward) */}
          <mesh position={[xSign * 0.3, 0, 0.15 + frontDepth / 2]} castShadow>
            <boxGeometry args={[0.3 - gap, height - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Door 2 (facing sideways) */}
          <mesh position={[xSign * (0.15 + frontDepth / 2), 0, 0.3]} castShadow>
            <boxGeometry args={[frontDepth, height - gap, 0.3 - gap]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Horizontale greep deur 1 */}
          <mesh position={[xSign * 0.3, height / 2 - 0.08, 0.15 + frontDepth + 0.012]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.006, 0.006, 0.14, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>
          {/* Horizontale greep deur 2 */}
          <mesh position={[xSign * (0.15 + frontDepth + 0.012), height / 2 - 0.08, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.14, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>
        </group>
      )
    }

    // Hoekbovenkast (Corner wall cabinet)
    if (resolvedType === 'wall_corner_L') {
      const isLeftCorner = cabinet.wall === 'back' ? cabinet.offset <= 1.5 : cabinet.wall === 'left'
      const xSign = isLeftCorner ? -1 : 1
      return (
        <group>
          {/* Door 1 (facing forward) */}
          <mesh position={[xSign * 0.175, 0, -0.1 + frontDepth / 2]} castShadow>
            <boxGeometry args={[0.55 - gap, height - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Door 2 (facing sideways) */}
          <mesh position={[-xSign * (0.1 - frontDepth / 2), 0, 0.175]} castShadow>
            <boxGeometry args={[frontDepth, height - gap, 0.55 - gap]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Handle 1 (Door 1) */}
          <mesh position={[xSign * 0.175, -height / 2 + 0.07, -0.1 + frontDepth + 0.012]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.006, 0.006, 0.14, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>
          {/* Handle 2 (Door 2) */}
          <mesh position={[-xSign * (0.1 - frontDepth - 0.012), -height / 2 + 0.07, 0.175]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.14, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>
        </group>
      )
    }

    // Standaard onderkasten (Base units)
    // De fronten hangen aan de voorkant van de kast body
    const baseHeight = height <= 0.85 ? height : 0.8
    const gripLen = width * 0.55
    const gripR = 0.007
    const lineH = 0.004
    const lineD = frontDepth + 0.002

    if (resolvedType === 'base_drawer') {
      // 3 lades voor ME201: kleine bovenlade + middellade + grote onderlade
      const topH    = baseHeight * 0.17  // ~14cm bij 80cm kast
      const midH    = baseHeight * 0.33  // ~26cm
      const bottomH = baseHeight - topH - midH - gap * 2

      // Y-posities (0 = midden van de kast op floor-level, kast zit van -bH/2 tot +bH/2)
      const topY    = baseHeight / 2 - topH / 2
      const midY    = baseHeight / 2 - topH - gap - midH / 2
      const botY    = -baseHeight / 2 + bottomH / 2

      // Naadlijn Y-posities (horizontale scheidingslijn tussen lades)
      const seam1Y  = baseHeight / 2 - topH - gap / 2
      const seam2Y  = -baseHeight / 2 + bottomH + gap / 2

      return (
        <group position={[0, 0, depth / 2 + frontDepth / 2]}>

          {/* === Bovenkant-lade (besteklade) === */}
          <mesh position={[0, topY, 0]}>
            <boxGeometry args={[width - gap, topH - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Greep bovenlade – horizontale balk */}
          <mesh position={[0, topY, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[gripR, gripR, gripLen, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>

          {/* Naadlijn 1 (scheiding boven/midden) */}
          <mesh position={[0, seam1Y, 0]}>
            <boxGeometry args={[width, lineH, lineD]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.1} />
          </mesh>

          {/* === Middelste lade === */}
          <mesh position={[0, midY, 0]}>
            <boxGeometry args={[width - gap, midH - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Greep middellade */}
          <mesh position={[0, midY, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[gripR, gripR, gripLen, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>

          {/* Naadlijn 2 (scheiding midden/onder) */}
          <mesh position={[0, seam2Y, 0]}>
            <boxGeometry args={[width, lineH, lineD]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.1} />
          </mesh>

          {/* === Onderste lade (grootste) === */}
          <mesh position={[0, botY, 0]}>
            <boxGeometry args={[width - gap, bottomH - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Greep onderlade */}
          <mesh position={[0, botY, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[gripR, gripR, gripLen, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>

        </group>
      )
    }

    if (resolvedType === 'base_door' || resolvedType === 'base_sink' || resolvedType === 'base_dishwasher') {
      // 1 of 2 deuren (draaideur of vaatwasser front)
      const hasDoubleDoors = width >= 0.8
      const hasDummyDrawer = resolvedType === 'base_sink' // spoelkast heeft vaak een blindpaneel bovenin
      const doorGripLen = (hasDoubleDoors ? width / 2 : width) * 0.55

      if (hasDummyDrawer) {
        const dummyH = 0.14
        const doorH = baseHeight - dummyH
        // Naadlijn tussen blindpaneel en deur
        const seamY = baseHeight / 2 - dummyH - gap / 2
        return (
          <group position={[0, 0, depth / 2 + frontDepth / 2]}>
            {/* Blindpaneel lade (met kleine horizontale greep) */}
            <mesh position={[0, baseHeight / 2 - dummyH / 2, 0]}>
              <boxGeometry args={[width - gap, dummyH - gap, frontDepth]} />
              <primitive object={woodMaterial} attach="material" />
            </mesh>
            {/* Naadlijn blindpaneel / deur */}
            <mesh position={[0, seamY, 0]}>
              <boxGeometry args={[width, lineH, lineD]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.1} />
            </mesh>
            {/* Deuren eronder */}
            {hasDoubleDoors ? (
              <>
                <mesh position={[-width / 4, -baseHeight / 2 + doorH / 2, 0]}>
                  <boxGeometry args={[width / 2 - gap, doorH - gap, frontDepth]} />
                  <primitive object={woodMaterial} attach="material" />
                </mesh>
                <mesh position={[width / 4, -baseHeight / 2 + doorH / 2, 0]}>
                  <boxGeometry args={[width / 2 - gap, doorH - gap, frontDepth]} />
                  <primitive object={woodMaterial} attach="material" />
                </mesh>
                {/* Horizontale handgrepen */}
                <mesh position={[-width / 4, -baseHeight / 2 + doorH - 0.08, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[gripR, gripR, doorGripLen, 8]} />
                  <primitive object={metalMaterial} attach="material" />
                </mesh>
                <mesh position={[width / 4, -baseHeight / 2 + doorH - 0.08, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[gripR, gripR, doorGripLen, 8]} />
                  <primitive object={metalMaterial} attach="material" />
                </mesh>
              </>
            ) : (
              <>
                <mesh position={[0, -baseHeight / 2 + doorH / 2, 0]}>
                  <boxGeometry args={[width - gap, doorH - gap, frontDepth]} />
                  <primitive object={woodMaterial} attach="material" />
                </mesh>
                {/* Horizontale handgreep */}
                <mesh position={[0, -baseHeight / 2 + doorH - 0.08, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[gripR, gripR, doorGripLen, 8]} />
                  <primitive object={metalMaterial} attach="material" />
                </mesh>
              </>
            )}
          </group>
        )
      }

      // Standaard draaideur of vaatwasserpaneel
      return (
        <group position={[0, 0, depth / 2 + frontDepth / 2]}>
          {hasDoubleDoors ? (
            <>
              <mesh position={[-width / 4, 0, 0]}>
                <boxGeometry args={[width / 2 - gap, baseHeight - gap, frontDepth]} />
                <primitive object={woodMaterial} attach="material" />
              </mesh>
              <mesh position={[width / 4, 0, 0]}>
                <boxGeometry args={[width / 2 - gap, baseHeight - gap, frontDepth]} />
                <primitive object={woodMaterial} attach="material" />
              </mesh>
              {/* Horizontale greepjes bovenaan dubbele deuren */}
              <mesh position={[-width / 4, baseHeight / 2 - 0.08, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[gripR, gripR, doorGripLen, 8]} />
                <primitive object={metalMaterial} attach="material" />
              </mesh>
              <mesh position={[width / 4, baseHeight / 2 - 0.08, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[gripR, gripR, doorGripLen, 8]} />
                <primitive object={metalMaterial} attach="material" />
              </mesh>
            </>
          ) : (
            <>
              <mesh>
                <boxGeometry args={[width - gap, baseHeight - gap, frontDepth]} />
                <primitive object={woodMaterial} attach="material" />
              </mesh>
              {/* Horizontale greep bovenaan de deur */}
              {resolvedType !== 'base_dishwasher' && (
                <mesh position={[0, baseHeight / 2 - 0.08, frontDepth / 2 + 0.012]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[gripR, gripR, doorGripLen, 8]} />
                  <primitive object={metalMaterial} attach="material" />
                </mesh>
              )}
            </>
          )}
        </group>
      )
    }

    return null
  }

  // Extra attributen zoals spoelbak of kookplaat
  const renderAppliances = () => {
    if (type === 'sink') {
      // Y van bovenkant kast = height/2, werkblad zit 0.04m daarboven
      const sinkTopY = height / 2 + 0.04
      return (
        <group>
          {/* Reginox Queen 60 GLTF – geplaatst op hoogte van bovenkant werkblad */}
          <Suspense fallback={null}>
            <group position={[0, sinkTopY, 0]}>
              <ReginoxSink metalMaterial={metalMaterial} />
            </group>
          </Suspense>
          {/* Kraan op achterkant spoelbak (Z- = wandzijde na rotatiefixatie) */}
          <group position={[0, sinkTopY + 0.01, -depth / 2 + 0.06]}>
            {/* Kraanvoet */}
            <mesh castShadow>
              <cylinderGeometry args={[0.01, 0.01, 0.08, 12]} />
              <primitive object={metalMaterial} attach="material" />
            </mesh>
            {/* Kraanhals boog */}
            <mesh position={[0, 0.12, 0.03]} castShadow>
              <torusGeometry args={[0.06, 0.008, 8, 24, Math.PI]} />
              <primitive object={metalMaterial} attach="material" />
            </mesh>
          </group>
        </group>
      )
    }

    if (code === 'KA60') {
      return (
        <group position={[0, height / 2 + 0.041, 0]}>
          {/* Kookplaat inductie glasplaat */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.58, 0.004, 0.51]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.15} metalness={0.9} />
          </mesh>
          {/* Kookzones */}
          <mesh position={[-0.14, 0.0025, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.06, 0.065, 32]} />
            <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.3} />
          </mesh>
          <mesh position={[0.14, 0.0025, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.08, 0.085, 32]} />
            <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.3} />
          </mesh>
          <mesh position={[-0.14, 0.0025, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.07, 0.075, 32]} />
            <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.3} />
          </mesh>
          <mesh position={[0.14, 0.0025, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.05, 0.055, 32]} />
            <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.3} />
          </mesh>
        </group>
      )
    }

    return null
  }

  // Roteer en positioneer de kast op basis van de wand
  const groupRotation = [0, cabinet.rotation || 0, 0]

  const isCorner = type === 'corner_L' || type === 'wall_corner_L'
  const isLeftCorner = cabinet.wall === 'back' ? cabinet.offset <= 1.5 : cabinet.wall === 'left'

  return (
    <group 
      position={position} 
      rotation={groupRotation} 
      onClick={(e) => {
        e.stopPropagation()
        onSelect(cabinet.id)
      }}
    >
      {/* Kast omtrek indicator indien geselecteerd */}
      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[width + 0.015, height + 0.015, depth + 0.015]} />
          <meshBasicMaterial color="#c49b6d" wireframe strokeWidth={2} />
        </mesh>
      )}

      {/* Main Cabinet Carcass (de body) */}
      {type === 'wall_corner_L' ? (
        <group>
          {/* Back block: width 0.9, depth 0.35 */}
          <mesh position={[0, 0, -0.275]} castShadow receiveShadow>
            <boxGeometry args={[0.9, height, 0.35]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Extension block: width 0.35, depth 0.55 */}
          <mesh position={[isLeftCorner ? 0.275 : -0.275, 0, 0.175]} castShadow receiveShadow>
            <boxGeometry args={[0.35, height, 0.55]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
        </group>
      ) : isCorner ? (
        <group>
          <mesh position={[0, 0, -0.15]} castShadow receiveShadow>
            <boxGeometry args={[width, height, 0.6]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          <mesh position={[isLeftCorner ? 0.15 : -0.15, 0, 0.3]} castShadow receiveShadow>
            <boxGeometry args={[0.6, height, 0.3]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
        </group>
      ) : type === 'open_shelf' ? (
        // Open kast met 1 legplank (schap)
        <group>
          {/* Bodem */}
          <mesh position={[0, -height / 2 + 0.009, 0]} castShadow receiveShadow>
            <boxGeometry args={[width, 0.018, depth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Top */}
          <mesh position={[0, height / 2 - 0.009, 0]} castShadow receiveShadow>
            <boxGeometry args={[width, 0.018, depth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Linkerzijwand */}
          <mesh position={[-width / 2 + 0.009, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.018, height - 0.036, depth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Rechterzijwand */}
          <mesh position={[width / 2 - 0.009, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.018, height - 0.036, depth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Achterwand */}
          <mesh position={[0, 0, -depth / 2 + 0.009]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.036, height - 0.036, 0.018]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Legplank (schap) in het midden */}
          <mesh position={[0, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.036, 0.018, depth - 0.036]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
        </group>
      ) : type === 'sink' ? (
        // Spoelkast: U-vorm zonder bovenpaneel zodat de spoelbak erdoorheen kan zakken
        <group>
          {/* Bodem */}
          <mesh position={[0, -height / 2 + 0.009, 0]} castShadow receiveShadow>
            <boxGeometry args={[width, 0.018, depth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Linkerzijwand */}
          <mesh position={[-width / 2 + 0.009, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.018, height, depth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Rechterzijwand */}
          <mesh position={[width / 2 - 0.009, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.018, height, depth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Achterwand */}
          <mesh position={[0, 0, -depth / 2 + 0.009]} castShadow receiveShadow>
            <boxGeometry args={[width, height, 0.018]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
        </group>
      ) : type === 'tall' ? (
        <group>
          {/* Carcass */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[width, height - 0.1, depth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Plint */}
          <mesh position={[0, -(height - 0.1) / 2 - 0.05, depth / 2 - 0.07 - 0.01]} castShadow receiveShadow>
            <boxGeometry args={[width, 0.1, 0.02]} />
            <meshStandardMaterial color="#404040" roughness={0.8} metalness={0.1} />
          </mesh>
        </group>
      ) : (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, height, depth]} />
          <primitive object={woodMaterial} attach="material" />
        </mesh>
      )}

      {/* Kastdeurtjes / Ladefronten */}
      {renderFronts()}

      {/* Ingebouwde apparaten */}
      {renderAppliances()}
    </group>
  )
}

export default function ThreeDView({
  cabinets,
  selectedCabinetId,
  onSelectCabinet,
  selectedOpeningId,
  onSelectOpening,
  selectedMaterial,
  wallDimensions = { back: 4.0, right: 4.74 },
  roomShape = 'L-shape',
  openings = [],
  floorType = 'wood',
  draggingId = null,
  showAxes = false,
}) {
  const axesRef = useRef()

  // Zorg dat de wereld-assen altijd "bovenop" de geometrie renderen (geen Z-fighting of verdwijnen in vloer/muur)
  useEffect(() => {
    if (axesRef.current) {
      axesRef.current.material.depthTest = false
      axesRef.current.renderOrder = 999
    }
  }, [showAxes])

  const woodFloorTexture = useMemo(() => createFloorTexture(), [])

  // Echte fototextuur inladen voor rustiek eiken
  const naturalOakTexture = useMemo(() => {
    const loader = new THREE.TextureLoader()
    const texture = loader.load(`${import.meta.env.BASE_URL}textures/22rustiekEik.jpg`)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(1, 1)
    return texture
  }, [])

  // PBR-achtige materialen maken op basis van de geselecteerde houtkleur
  const materials = useMemo(() => {
    const isSolid = selectedMaterial.id.startsWith('matte')
    
    let woodMaterial
    if (isSolid) {
      woodMaterial = new THREE.MeshStandardMaterial({
        color: selectedMaterial.color,
        roughness: selectedMaterial.roughness,
        metalness: 0.1
      })
    } else if (selectedMaterial.id === 'natural_oak') {
      woodMaterial = new THREE.MeshStandardMaterial({
        map: naturalOakTexture,
        roughness: selectedMaterial.roughness,
        metalness: 0.05,
        bumpMap: naturalOakTexture,
        bumpScale: 0.002
      })
    } else {
      // Genereer de nerf-textuur
      const woodTexture = createWoodTexture(selectedMaterial.color, '#000000')
      
      // Hout materiaal
      woodMaterial = new THREE.MeshStandardMaterial({
        map: woodTexture,
        roughness: selectedMaterial.roughness,
        metalness: 0.05,
        bumpMap: woodTexture,
        bumpScale: 0.001
      })
    }
    
    // Werkblad materiaal (beton/steen look)
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: '#404347',
      roughness: 0.65,
      metalness: 0.05
    })

    // Metalen grepen en kraan materiaal (RVS/chroom – geborsteld staal)
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: '#c8c4ba',
      roughness: 0.25,
      metalness: 0.80
    })

    return { woodMaterial, stoneMaterial, metalMaterial }
  }, [selectedMaterial])

  const walls = useMemo(() => getWalls(roomShape, wallDimensions), [roomShape, wallDimensions])

  // Genereer het doorlopende werkblad (continuous worktop) voor onderkasten per wand
  const renderContinuousElements = () => {
    const baseWalls = ['back', 'right', 'left']
    const elements = []

    baseWalls.forEach(wallId => {
      // Begin met kasten die direct op deze muur staan
      let baseCabinets = cabinets.filter(
        c => c.wall === wallId
          && (c.type.startsWith('base') || ['door', 'drawers', 'sink', 'corner_L', 'open_shelf'].includes(c.type))
          && c.id !== draggingId  // sluit sleepende kast uit van werkblad-berekening
      )

      let wall = walls.find(w => w.id === wallId)
      if (!wall) {
        if (wallId === 'right') {
          wall = {
            id: 'right',
            x1: 0,
            z1: 0,
            x2: 0,
            z2: wallDimensions.right || 3.0,
            normalX: -1,
            normalZ: 0,
            angle: -Math.PI / 2,
            length: wallDimensions.right || 3.0
          }
        } else if (wallId === 'left') {
          wall = {
            id: 'left',
            x1: -wallDimensions.back,
            z1: 0,
            x2: -wallDimensions.back,
            z2: wallDimensions.left || 3.0,
            normalX: 1,
            normalZ: 0,
            angle: Math.PI / 2,
            length: wallDimensions.left || 3.0
          }
        }
      }

      // Voeg virtuele hoekkasten toe van aangrenzende muren die deze muur raken
      cabinets.forEach(c => {
        if (c.type === 'corner_L' && c.id !== draggingId) {
          if (wallId === 'back') {
            // Hoekkast op right/left wand raakt ook de back wand als offset <= 0.5
            if ((c.wall === 'right' || c.wall === 'left') && c.offset <= 0.5) {
              if (!baseCabinets.some(existing => existing.id === c.id)) {
                const backOffset = c.wall === 'right' ? 0.45 : (wall ? wall.length - 0.45 : 3.55)
                baseCabinets.push({ ...c, wall: 'back', offset: backOffset, width: 0.9 })
              }
            }
          } else if (wallId === 'right') {
            // Hoekkast op back wand raakt right wand als offset <= 0.5
            if (c.wall === 'back' && c.offset <= 0.5) {
              if (!baseCabinets.some(existing => existing.id === c.id)) {
                baseCabinets.push({ ...c, wall: 'right', offset: 0.45, width: 0.9 })
              }
            }
          } else if (wallId === 'left') {
            // Hoekkast op back wand raakt left wand als offset >= wall.length - 0.5
            const backLength = wallDimensions.back || 4.0
            if (c.wall === 'back' && c.offset >= backLength - 0.5) {
              if (!baseCabinets.some(existing => existing.id === c.id)) {
                baseCabinets.push({ ...c, wall: 'left', offset: 0.45, width: 0.9 })
              }
            }
          }
        }
      })

      if (baseCabinets.length === 0) return
      if (!wall) return

      const dx = (wall.x2 - wall.x1) / wall.length
      const dz = (wall.z2 - wall.z1) / wall.length

      const worktopThickness = 0.04
      const worktopDepth = 0.65
      const plinthHeight = 0.1

      const y = 0.8 + 0.1 + worktopThickness / 2
      const py = plinthHeight / 2
      const wtZ = worktopDepth / 2 - 0.005

      // Sorteer kasten op offset
      const sortedCabs = [...baseCabinets].sort((a, b) => a.offset - b.offset)
      const groups = []
      let currentGroup = [sortedCabs[0]]

      // Groepeer aangrenzende kasten (tolerantiegrens van 5 cm)
      for (let i = 1; i < sortedCabs.length; i++) {
        const lastCabinet = currentGroup[currentGroup.length - 1]
        const currentCabinet = sortedCabs[i]
        const lastEnd = lastCabinet.offset + lastCabinet.width / 2
        const currentStart = currentCabinet.offset - currentCabinet.width / 2

        if (currentStart <= lastEnd + 0.05) {
          currentGroup.push(currentCabinet)
        } else {
          groups.push(currentGroup)
          currentGroup = [currentCabinet]
        }
      }
      groups.push(currentGroup)

      // Teken werkbladen en plinten per aaneengesloten groep
      groups.forEach((group, groupIdx) => {
        let minOffset = Infinity
        let maxOffset = -Infinity
        group.forEach(c => {
          const start = c.offset - c.width / 2
          const end = c.offset + c.width / 2
          if (start < minOffset) minOffset = start
          if (end > maxOffset) maxOffset = end
        })

        const totalLen = maxOffset - minOffset
        const centerOffset = (minOffset + maxOffset) / 2

        const centerX = wall.x1 + centerOffset * dx
        const centerZ = wall.z1 + centerOffset * dz

        // Vind eventuele spoelkasten in deze specifieke groep
        const sinkCabinets = group.filter(c => c.type === 'sink')

        if (sinkCabinets.length === 0) {
          // Geen spoelkast in deze groep → gewoon één doorlopend blad
          elements.push(
            <group
              key={`wt-${wallId}-${groupIdx}`}
              position={[centerX, 0, centerZ]}
              rotation={[0, wall.angle, 0]}
            >
              <mesh position={[0, y, wtZ]} castShadow receiveShadow>
                <boxGeometry args={[totalLen, worktopThickness, worktopDepth]} />
                <primitive object={materials.stoneMaterial} attach="material" />
              </mesh>
              <mesh position={[0, py, 0.60 - 0.07 - 0.01]} castShadow receiveShadow>
                <boxGeometry args={[totalLen, plinthHeight, 0.02]} />
                <meshStandardMaterial color="#404040" roughness={0.8} metalness={0.1} />
              </mesh>
            </group>
          )
        } else {
          // Met spoelkast(en) in deze groep: bouw segmenten rondom de gaten
          const groupMeshes = []
          const groupKey = `wt-${wallId}-${groupIdx}`

          const holeW = 0.53  // breedte van het gat in het blad
          const holeD = 0.41  // diepte van het gat in het blad

          const holes = sinkCabinets.map(sc => {
            const alignFactor = dx * Math.cos(wall.angle) - dz * Math.sin(wall.angle)
            const scLocalOffset = (sc.offset - centerOffset) * alignFactor
            return { x0: scLocalOffset - holeW / 2, x1: scLocalOffset + holeW / 2, cab: sc }
          })
          holes.sort((a, b) => a.x0 - b.x0)

          let cursor = -totalLen / 2
          holes.forEach((hole, i) => {
            // Stuk vóór het gat
            if (hole.x0 > cursor + 0.001) {
              const segW = hole.x0 - cursor
              const segCX = cursor + segW / 2
              groupMeshes.push(
                <mesh key={`seg-${i}-before`} position={[segCX, y, wtZ]} castShadow receiveShadow>
                  <boxGeometry args={[segW, worktopThickness, worktopDepth]} />
                  <primitive object={materials.stoneMaterial} attach="material" />
                </mesh>
              )
            }
            // Stukken aan voor- en achterkant van het gat
            const holeCX = hole.x0 + holeW / 2
            const holeZCenter = 0.35

            const worktopStart = wtZ - worktopDepth / 2
            const worktopEnd = wtZ + worktopDepth / 2
            const holeStart = holeZCenter - holeD / 2
            const holeEnd = holeZCenter + holeD / 2

            const stripD_back = holeStart - worktopStart
            const posZ_back = worktopStart + stripD_back / 2

            const stripD_front = worktopEnd - holeEnd
            const posZ_front = holeEnd + stripD_front / 2

            groupMeshes.push(
              <mesh key={`seg-${i}-back`} position={[holeCX, y, posZ_back]} castShadow receiveShadow>
                <boxGeometry args={[holeW, worktopThickness, stripD_back]} />
                <primitive object={materials.stoneMaterial} attach="material" />
              </mesh>
            )
            groupMeshes.push(
              <mesh key={`seg-${i}-front`} position={[holeCX, y, posZ_front]} castShadow receiveShadow>
                <boxGeometry args={[holeW, worktopThickness, stripD_front]} />
                <primitive object={materials.stoneMaterial} attach="material" />
              </mesh>
            )
            cursor = hole.x1
          })

          // Stuk na het laatste gat
          if (cursor < totalLen / 2 - 0.001) {
            const segW = totalLen / 2 - cursor
            const segCX = cursor + segW / 2
            groupMeshes.push(
              <mesh key="seg-after" position={[segCX, y, wtZ]} castShadow receiveShadow>
                <boxGeometry args={[segW, worktopThickness, worktopDepth]} />
                <primitive object={materials.stoneMaterial} attach="material" />
              </mesh>
            )
          }

          // Plint doorloopt de hele groep ononderbroken
          groupMeshes.push(
            <mesh key="plinth" position={[0, py, 0.60 - 0.07 - 0.01]} castShadow receiveShadow>
              <boxGeometry args={[totalLen, plinthHeight, 0.02]} />
              <meshStandardMaterial color="#404040" roughness={0.8} metalness={0.1} />
            </mesh>
          )

          elements.push(
            <group
              key={groupKey}
              position={[centerX, 0, centerZ]}
              rotation={[0, wall.angle, 0]}
            >
              {groupMeshes}
            </group>
          )
        }
      })
    })

    return elements.length > 0 ? <group>{elements}</group> : null
  }

  const renderOpenings3D = () => {
    if (!openings || openings.length === 0) return null

    const wallMap = {}
    walls.forEach(w => wallMap[w.id] = w)

    return openings.map(opening => {
      const wall = wallMap[opening.wall]
      if (!wall) return null

      const dsx = (wall.x2 - wall.x1) / wall.length
      const dsz = (wall.z2 - wall.z1) / wall.length

      const centerOff = opening.offset + opening.width / 2
      const x = wall.x1 + dsx * centerOff
      const z = wall.z1 + dsz * centerOff

      if (opening.type === 'door') {
        const doorH = opening.height
        const doorW = opening.width
        const isSelected = selectedOpeningId === opening.id

        return (
          <group key={opening.id} position={[x, 0, z]} rotation={[0, wall.angle, 0]} onClick={(e) => { e.stopPropagation(); onSelectOpening(opening.id); }}>
            {isSelected && (
              <mesh position={[0, doorH / 2, 0]}>
                <boxGeometry args={[doorW + 0.02, doorH + 0.02, 0.06]} />
                <meshBasicMaterial color="#c49b6d" wireframe />
              </mesh>
            )}
            <mesh position={[0, doorH / 2, 0.06]} receiveShadow>
              <boxGeometry args={[doorW - 0.04, doorH - 0.04, 0.04]} />
              <meshStandardMaterial color="#d4c8b8" roughness={0.5} metalness={0.05} />
            </mesh>
            <mesh position={[0, doorH / 2, -0.01]}>
              <boxGeometry args={[doorW - 0.08, doorH - 0.08, 0.01]} />
              <meshStandardMaterial color="#e8ddd0" roughness={0.4} metalness={0.05} />
            </mesh>
            <mesh position={[doorW / 2 - 0.08, doorH * 0.45, 0.04]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.01, 0.01, 0.12, 8]} />
              <meshStandardMaterial color="#c0c0c0" roughness={0.2} metalness={0.9} />
            </mesh>
          </group>
        )
      }

      if (opening.type === 'window') {
        const winH = opening.height
        const winW = opening.width
        const sillY = opening.sillHeight || 0.9
        const winCY = sillY + winH / 2
        const isSelected = selectedOpeningId === opening.id

        return (
          <group key={opening.id} position={[x, winCY, z]} rotation={[0, wall.angle, 0]} onClick={(e) => { e.stopPropagation(); onSelectOpening(opening.id); }}>
            {isSelected && (
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[winW + 0.08, winH + 0.08, 0.06]} />
                <meshBasicMaterial color="#c49b6d" wireframe />
              </mesh>
            )}
            <mesh position={[0, 0, 0.04]}>
              <boxGeometry args={[winW + 0.06, winH + 0.06, 0.04]} />
              <meshStandardMaterial color="#d4c8b8" roughness={0.5} metalness={0.05} />
            </mesh>
            <mesh position={[0, 0, -0.01]}>
              <boxGeometry args={[winW - 0.02, winH - 0.02, 0.005]} />
              <meshStandardMaterial color="#a8d0e8" roughness={0.1} metalness={0.1} transparent opacity={0.5} />
            </mesh>
            <mesh position={[0, -winH / 2 - 0.015, 0.03]}>
              <boxGeometry args={[winW + 0.1, 0.03, 0.1]} />
              <meshStandardMaterial color="#d4c8b8" roughness={0.5} metalness={0.05} />
            </mesh>
          </group>
        )
      }

      return null
    })
  }

  return (
    <div className="canvas-container">
      {/* 3D Canvas */}
      <Canvas 
        camera={{ position: [-6.5, 5.5, 7.2], fov: 45 }}
        shadows
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.70 }}
      >
        <color attach="background" args={['#ffffff']} />

        {/* Wereld hulp-assen (Rood = X, Groen = Y, Blauw = Z) op [0,0,0] */}
        {showAxes && <axesHelper ref={axesRef} args={[3.0]} />}

        {/* Omgevingskaart voor correcte PBR-weergave van metalen oppervlakken */}
        <Environment preset="studio" />

        {/* Belichting */}
        {/* Ambient vullicht en hemisphere voor uniforme belichting */}
        <ambientLight intensity={0.10} />
        <hemisphereLight skyColor="#ffffff" groundColor="#ebdcb0" intensity={0.02} />
        
        {/* Lichtbron die meebeweegt met de camera (headlight) voor egale belichting van alle kijkhoeken */}
        <CameraLight />

        {/* Een zacht, statisch zonlicht voor de schaduwen op de muur en dieptewerking */}
        <directionalLight 
          position={[2.5, 8, 2.5]} 
          intensity={0.15} 
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={25}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-bias={-0.0005}
        />

        {/* Dynamische muren op basis van roomShape */}
        {walls.map(wall => {
          const cx3 = (wall.x1 + wall.x2) / 2
          const cz3 = (wall.z1 + wall.z2) / 2
          return (
            <mesh key={wall.id} position={[cx3, 1.25, cz3]} rotation={[0, wall.angle, 0]} receiveShadow>
              <boxGeometry args={[wall.length, 2.5, 0.1]} />
              <meshStandardMaterial color="#d2d2cc" roughness={0.95} />
            </mesh>
          )
        })}

        {/* Vloer */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-wallDimensions.back / 2, 0, wallDimensions.right / 2]} receiveShadow>
          <planeGeometry args={[wallDimensions.back, wallDimensions.right]} />
          {floorType === 'wood' ? (
            <meshStandardMaterial key="wood" map={woodFloorTexture} roughness={0.4} />
          ) : (
            <meshStandardMaterial key="tiles" color="#918d83" roughness={0.5} />
          )}
        </mesh>

        {/* Fijn raster op de vloer voor IKEA-gevoel */}
        <Grid 
          position={[-wallDimensions.back / 2, 0.001, wallDimensions.right / 2]}
          args={[wallDimensions.back, wallDimensions.right]}
          cellSize={0.6} 
          cellThickness={1.2} 
          cellColor="#a39f96"
          sectionSize={1.8}
          sectionThickness={0}
          fadeDistance={30}
          infiniteGrid={false}
        />

        {/* Voorbeeldopstelling instructie-tekst op de vloer */}
        {cabinets.some(c => c.id.startsWith('demo-')) && (
          <Text
            position={[-wallDimensions.back / 2, 0.005, wallDimensions.right / 2 + 0.5]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.14}
            color="#6e6c64"
            maxWidth={3.0}
            textAlign="center"
          >
            Voorbeeldopstelling
            {"\n"}
            Klik op 'Nieuw Ontwerp' voor uw eigen ontwerp
          </Text>
        )}

        {/* Render alle kasten */}
        {cabinets.map((cab) => (
          <Cabinet3D 
            key={cab.id}
            cabinet={cab}
            isSelected={cab.id === selectedCabinetId}
            onSelect={onSelectCabinet}
            woodMaterial={materials.woodMaterial}
            metalMaterial={materials.metalMaterial}
          />
        ))}

        {/* Doorlopende bladen en plinten */}
        {renderContinuousElements()}

        {/* Ramen en deuren */}
        {renderOpenings3D()}

        {/* Zachte contactschaduwen op de vloer */}
        <ContactShadows 
          position={[-wallDimensions.back / 2, 0.01, wallDimensions.right / 2]}
          opacity={0.45} 
          scale={5} 
          blur={1.8} 
          far={1.5}
        />

        {/* Rondkijken controls */}
        <OrbitControls 
          makeDefault 
          minDistance={1.8} 
          maxDistance={12} 
          maxPolarAngle={Math.PI / 2 - 0.02} // Niet onder de vloer kijken
          target={[-1.2, 0.9, 2.3]} // Richt camera op het aanrecht
        />
      </Canvas>

      {/* Hint voor de gebruiker */}
      <div className="camera-hint">
        <span>🖱️ Drag om te draaien • Scroll om te zoomen • Klik op een module</span>
      </div>
    </div>
  )
}
