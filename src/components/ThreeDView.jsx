import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

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
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 4) // Rek de nerf uit in de lengte voor een realistisch paneel
  return texture
}

// 3D Cabinet Component
function Cabinet3D({ cabinet, isSelected, onSelect, woodMaterial, metalMaterial }) {
  const { width, height, depth, position, type, code } = cabinet

  // Drawer / door front layout per cabinet type
  const renderFronts = () => {
    const gap = 0.004 // 4mm naad tussen lades
    const frontDepth = 0.02 // 2cm dikke fronten

    if (type === 'tall') {
      // Hoge kast: een onderdeur en een bovendeur
      const lowerDoorH = 0.72
      const upperDoorH = height - lowerDoorH - gap - 0.1 // plinth is 10cm
      return (
        <group position={[0, 0.05, depth / 2 + frontDepth / 2]}>
          {/* Onderste front */}
          <mesh position={[0, -height / 2 + 0.1 + lowerDoorH / 2, 0]}>
            <boxGeometry args={[width - gap, lowerDoorH, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Handgreep onderdeur */}
          <mesh position={[width / 2 - 0.05, -height / 2 + 0.1 + lowerDoorH - 0.1, frontDepth / 2 + 0.01]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.12, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>

          {/* Bovenste front */}
          <mesh position={[0, -height / 2 + 0.1 + lowerDoorH + gap + upperDoorH / 2, 0]}>
            <boxGeometry args={[width - gap, upperDoorH - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Handgreep bovendeur */}
          <mesh position={[width / 2 - 0.05, -height / 2 + 0.1 + lowerDoorH + gap + 0.3, frontDepth / 2 + 0.01]}>
            <cylinderGeometry args={[0.005, 0.005, 0.12, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>
        </group>
      )
    }

    if (type === 'wall' || type === 'wall_extractor') {
      // Bovenkast: 1 of 2 draaideuren afhankelijk van breedte
      return (
        <group position={[0, 0, depth / 2 + frontDepth / 2]}>
          <mesh>
            <boxGeometry args={[width - gap, height - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          {/* Vertical handgreep onderaan de deur */}
          <mesh position={[width / 2 - 0.05, -height / 2 + 0.1, frontDepth / 2 + 0.01]}>
            <cylinderGeometry args={[0.005, 0.005, 0.10, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>
          {/* Afzuigkap kap onderkant indien afzuigkast */}
          {type === 'wall_extractor' && (
            <mesh position={[0, -height / 2 - 0.02, -depth / 4]} castShadow>
              <boxGeometry args={[width, 0.04, depth / 2]} />
              <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.8} />
            </mesh>
          )}
        </group>
      )
    }

    // Standaard onderkasten (Base units)
    // De fronten hangen aan de voorkant van de kast body
    const baseHeight = 0.8

    if (type === 'base_drawer') {
      // 3 lades: besteklade, middellade, hoge lade
      const cutleryH = 0.14
      const midH = 0.28
      const lowH = 0.36
      return (
        <group position={[0, 0, depth / 2 + frontDepth / 2]}>
          {/* Besteklade (boven) */}
          <mesh position={[0, baseHeight / 2 - cutleryH / 2, 0]}>
            <boxGeometry args={[width - gap, cutleryH - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          <mesh position={[0, baseHeight / 2 - cutleryH / 2, frontDepth / 2 + 0.01]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.14, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>

          {/* Middellade */}
          <mesh position={[0, baseHeight / 2 - cutleryH - gap - midH / 2, 0]}>
            <boxGeometry args={[width - gap, midH - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          <mesh position={[0, baseHeight / 2 - cutleryH - gap - midH / 2, frontDepth / 2 + 0.01]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.14, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>

          {/* Onderste lade */}
          <mesh position={[0, -baseHeight / 2 + lowH / 2, 0]}>
            <boxGeometry args={[width - gap, lowH - gap, frontDepth]} />
            <primitive object={woodMaterial} attach="material" />
          </mesh>
          <mesh position={[0, -baseHeight / 2 + lowH / 2, frontDepth / 2 + 0.01]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.14, 8]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>
        </group>
      )
    }

    if (type === 'base_door' || type === 'base_sink' || type === 'base_dishwasher') {
      // 1 of 2 deuren (draaideur of vaatwasser front)
      const hasDoubleDoors = width >= 0.8
      const hasDummyDrawer = type === 'base_sink' // spoelkast heeft vaak een blindpaneel bovenin

      if (hasDummyDrawer) {
        const dummyH = 0.14
        const doorH = baseHeight - dummyH
        return (
          <group position={[0, 0, depth / 2 + frontDepth / 2]}>
            {/* Blindpaneel lade */}
            <mesh position={[0, baseHeight / 2 - dummyH / 2, 0]}>
              <boxGeometry args={[width - gap, dummyH - gap, frontDepth]} />
              <primitive object={woodMaterial} attach="material" />
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
                {/* Handgrepen */}
                <mesh position={[-0.02, -baseHeight / 2 + doorH - 0.1, frontDepth / 2 + 0.01]}>
                  <cylinderGeometry args={[0.005, 0.005, 0.10, 8]} />
                  <primitive object={metalMaterial} attach="material" />
                </mesh>
                <mesh position={[0.02, -baseHeight / 2 + doorH - 0.1, frontDepth / 2 + 0.01]}>
                  <cylinderGeometry args={[0.005, 0.005, 0.10, 8]} />
                  <primitive object={metalMaterial} attach="material" />
                </mesh>
              </>
            ) : (
              <>
                <mesh position={[0, -baseHeight / 2 + doorH / 2, 0]}>
                  <boxGeometry args={[width - gap, doorH - gap, frontDepth]} />
                  <primitive object={woodMaterial} attach="material" />
                </mesh>
                <mesh position={[width / 2 - 0.05, -baseHeight / 2 + doorH - 0.1, frontDepth / 2 + 0.01]}>
                  <cylinderGeometry args={[0.005, 0.005, 0.10, 8]} />
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
              <mesh position={[-0.02, baseHeight / 2 - 0.15, frontDepth / 2 + 0.01]}>
                <cylinderGeometry args={[0.005, 0.005, 0.10, 8]} />
                <primitive object={metalMaterial} attach="material" />
              </mesh>
              <mesh position={[0.02, baseHeight / 2 - 0.15, frontDepth / 2 + 0.01]}>
                <cylinderGeometry args={[0.005, 0.005, 0.10, 8]} />
                <primitive object={metalMaterial} attach="material" />
              </mesh>
            </>
          ) : (
            <>
              <mesh>
                <boxGeometry args={[width - gap, baseHeight - gap, frontDepth]} />
                <primitive object={woodMaterial} attach="material" />
              </mesh>
              {/* Geen zichtbare greep op vaatwasser of gewone kastgreep */}
              {type !== 'base_dishwasher' && (
                <mesh position={[width / 2 - 0.05, baseHeight / 2 - 0.15, frontDepth / 2 + 0.01]}>
                  <cylinderGeometry args={[0.005, 0.005, 0.10, 8]} />
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
    if (type === 'base_sink') {
      return (
        <group position={[0, height / 2 + 0.041, 0]}>
          {/* Spoelbak frame */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[width - 0.1, 0.002, depth - 0.1]} />
            <primitive object={metalMaterial} attach="material" />
          </mesh>
          {/* Kraan */}
          <group position={[0, 0, -depth / 2 + 0.08]}>
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

  // Roteer en positioneer de kast op basis van de wand ('right' of 'back')
  const groupRotation = cabinet.wall === 'right' ? [0, -Math.PI / 2, 0] : [0, 0, 0]

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
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <primitive object={woodMaterial} attach="material" />
      </mesh>

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
  selectedMaterial,
  wallDimensions = { back: 4.0, right: 4.74 }
}) {
  // PBR-achtige materialen maken op basis van de geselecteerde houtkleur
  const materials = useMemo(() => {
    // Genereer de nerf-textuur
    const woodTexture = createWoodTexture(selectedMaterial.color, '#000000')
    
    // Hout materiaal
    const woodMaterial = new THREE.MeshStandardMaterial({
      map: woodTexture,
      roughness: selectedMaterial.roughness,
      metalness: 0.05,
      bumpMap: woodTexture,
      bumpScale: 0.001
    })

    // Werkblad materiaal (beton/steen look)
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: '#4f5255',
      roughness: 0.7,
      metalness: 0.1
    })

    // Metalen grepen en kraan materiaal (RVS/chroom)
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: '#d4d0c5',
      roughness: 0.2,
      metalness: 0.95
    })

    return { woodMaterial, stoneMaterial, metalMaterial }
  }, [selectedMaterial])

  // Genereer het doorlopende werkblad (continuous worktop) voor onderkasten
  const renderContinuousElements = () => {
    const baseCabinetsRight = cabinets.filter(
      c => c.wall === 'right' && c.type.startsWith('base')
    )

    if (baseCabinetsRight.length === 0) return null

    // Sorteer de kasten langs de rechterwand op basis van hun Z positie (loopt van 0 tot 4.74)
    baseCabinetsRight.sort((a, b) => a.position[2] - b.position[2])

    // Vind de start en het einde van de onderkasten langs de Z-as
    const firstCab = baseCabinetsRight[0]
    const lastCab = baseCabinetsRight[baseCabinetsRight.length - 1]
    
    const startZ = firstCab.position[2] - firstCab.width / 2
    const endZ = lastCab.position[2] + lastCab.width / 2
    const totalLength = endZ - startZ

    const worktopThickness = 0.04
    const worktopDepth = 0.61 // Iets breder dan de kasten (overstek)
    const plinthHeight = 0.1

    // Middelpunt van het werkblad op de Z-as
    const centerZ = startZ + totalLength / 2

    return (
      <group>
        {/* Doorlopend Werkblad (Right Wall) */}
        <mesh 
          position={[-worktopDepth / 2 + 0.005, 0.8 + worktopThickness / 2, centerZ]} 
          castShadow 
          receiveShadow
        >
          {/* breedte=werkblad overstek, hoogte=dikte, diepte=totale lengte */}
          <boxGeometry args={[worktopDepth, worktopThickness, totalLength]} />
          <primitive object={materials.stoneMaterial} attach="material" />
        </mesh>

        {/* Doorlopende Plint (Right Wall) */}
        <mesh 
          position={[-0.05, plinthHeight / 2, centerZ]} 
          castShadow 
          receiveShadow
        >
          <boxGeometry args={[0.02, plinthHeight, totalLength]} />
          <meshStandardMaterial color="#2c2b29" roughness={0.9} />
        </mesh>
      </group>
    )
  }

  return (
    <div className="canvas-container">
      {/* 3D Canvas */}
      <Canvas 
        camera={{ position: [-5, 4.2, 5.5], fov: 45 }}
        shadows
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={['#eae8e1']} />

        {/* Belichting */}
        {/* Ambient vullicht */}
        <ambientLight intensity={0.65} />
        
        {/* Richtingslicht (Zonlicht) met schaduwen */}
        <directionalLight 
          position={[6, 9, 4]} 
          intensity={1.3} 
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={25}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-bias={-0.0005}
        />

        {/* Keuken spotjes (Lichtkegels op de wand) */}
        <spotLight 
          position={[-0.8, 2.3, 1.5]} 
          angle={Math.PI / 6} 
          penumbra={0.8} 
          intensity={8} 
          distance={4}
          color="#fff6e0"
        />
        <spotLight 
          position={[-0.8, 2.3, 3.2]} 
          angle={Math.PI / 6} 
          penumbra={0.8} 
          intensity={8} 
          distance={4}
          color="#fff6e0"
        />

        {/* L-Wanden (Muren) */}
        {/* Achterwand (X-as) */}
        <mesh position={[-wallDimensions.back / 2, 1.25, -0.05]} receiveShadow>
          <boxGeometry args={[wallDimensions.back, 2.5, 0.1]} />
          <meshStandardMaterial color="#dfdbd0" roughness={0.95} />
        </mesh>

        {/* Rechterwand (Z-as) */}
        <mesh position={[0.05, 1.25, wallDimensions.right / 2]} receiveShadow>
          <boxGeometry args={[0.1, 2.5, wallDimensions.right]} />
          <meshStandardMaterial color="#dfdbd0" roughness={0.95} />
        </mesh>

        {/* Vloer (Grijze plavuizen) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-wallDimensions.back / 2, 0, wallDimensions.right / 2]} receiveShadow>
          <planeGeometry args={[wallDimensions.back, wallDimensions.right]} />
          <meshStandardMaterial color="#918d83" roughness={0.5} />
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
