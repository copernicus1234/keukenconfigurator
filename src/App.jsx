import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ThreeDView from './components/ThreeDView'
import TwoDView from './components/TwoDView'
import { getWalls, getCabinetTransform } from './utils/geometry'

const DEFAULT_MATERIAL = {
  id: 'natural_oak',
  name: 'Natuurlijk Eiken',
  color: '#bfa37a',
  roughness: 0.85,
  previewColor: '#cfa976'
}

// Vooraf geladen voorbeeldkeuken (U-ruimte met L-opstelling kasten)
const INITIAL_CABINETS = [
  // Achterwand (back)
  { id: 'demo-c1', code: 'ME401', type: 'corner_L', width: 0.9, height: 0.8, depth: 0.9, wall: 'back', offset: 0.45, price: 379 },
  { id: 'demo-c2', code: 'ME201', type: 'drawers', width: 0.6, height: 0.8, depth: 0.6, wall: 'back', offset: 1.20, price: 319 },
  { id: 'demo-c3', code: 'ME102', type: 'door', width: 0.6, height: 0.8, depth: 0.6, wall: 'back', offset: 1.80, price: 189 },
  { id: 'demo-c4', code: 'ME103', type: 'door', width: 0.8, height: 0.8, depth: 0.6, wall: 'back', offset: 2.50, price: 229 },
  
  { id: 'demo-w1', code: 'WE401', type: 'wall_corner_L', width: 0.9, height: 0.6, depth: 0.9, wall: 'back', offset: 0.45, price: 249 },
  { id: 'demo-w2', code: 'WE101', type: 'wall', width: 0.6, height: 0.6, depth: 0.35, wall: 'back', offset: 1.20, price: 149 },
  { id: 'demo-w3', code: 'WE201', type: 'wall_extractor', width: 0.6, height: 0.6, depth: 0.35, wall: 'back', offset: 1.80, price: 289 },
  { id: 'demo-w4', code: 'WE102', type: 'wall', width: 0.8, height: 0.6, depth: 0.35, wall: 'back', offset: 2.50, price: 179 },

  // Rechterwand (right)
  { id: 'demo-r1', code: 'ME102', type: 'door', width: 0.6, height: 0.8, depth: 0.6, wall: 'right', offset: 1.20, price: 189 },
  { id: 'demo-r2', code: 'ME301', type: 'sink', width: 0.6, height: 0.8, depth: 0.6, wall: 'right', offset: 1.80, price: 249 },
  { id: 'demo-r3', code: 'ME201', type: 'drawers', width: 0.6, height: 0.8, depth: 0.6, wall: 'right', offset: 2.40, price: 319 },
  { id: 'demo-r4', code: 'HE101', type: 'tall', width: 0.6, height: 1.95, depth: 0.6, wall: 'right', offset: 3.00, price: 399 }
]

const INITIAL_OPENINGS = [
  // Deur linkerwand
  { id: 'demo-d1', type: 'door', wall: 'left', offset: 1.50, width: 0.8, height: 2.0, sillHeight: 0.0 },
  // Raam rechterwand (boven de spoelkast op offset 1.8)
  { id: 'demo-op1', type: 'window', wall: 'right', offset: 1.20, width: 1.2, height: 1.2, sillHeight: 0.9 }
]

export default function App() {
  const [roomShape, setRoomShape] = useState('U-shape') // 'straight' | 'L-shape' | 'U-shape'
  const [wallLengths, setWallLengths] = useState({ back: 4.0, right: 4.74, left: 3.0 })
  const [cabinets, setCabinets] = useState(INITIAL_CABINETS)
  const [openings, setOpenings] = useState(INITIAL_OPENINGS)
  const [selectedCabinetId, setSelectedCabinetId] = useState(null)
  const [selectedOpeningId, setSelectedOpeningId] = useState(null)
  const [selectedMaterial, setSelectedMaterial] = useState(DEFAULT_MATERIAL)
  const [floorType, setFloorType] = useState('wood') // 'tiles' | 'wood'
  const [showAxes, setShowAxes] = useState(false) // Toggle voor 3D Wereld-assen

  // Placement / drag states
  const [placingCabinet, setPlacingCabinet] = useState(null) // cabinet data being placed
  const [hoveredWallId, setHoveredWallId] = useState(null)
  const [hoveredOffset, setHoveredOffset] = useState(0)
  const [draggingId, setDraggingId] = useState(null) // id van kast die gesleept wordt

  // Bereken muren en transformaties dynamisch
  const walls = getWalls(roomShape, wallLengths)

  const cabinetsWithTransforms = cabinets.map(c => {
    const transform = getCabinetTransform(c, walls)
    return {
      ...c,
      position: transform.position,
      rotation: transform.rotation
    }
  })

  // Voeg een opening (raam/deur) toe
  const handleAddOpening = (type, wallId) => {
    const newOpening = {
      id: Date.now().toString(),
      type,
      wall: wallId,
      offset: 1.0, // Standaard aan begin van de muur
      width: type === 'door' ? 0.8 : 1.2,
      height: type === 'door' ? 2.0 : 1.2,
      sillHeight: type === 'door' ? 0.0 : 0.9
    }
    setOpenings(prev => [...prev, newOpening])
  }

  // Verwijder opening
  const handleDeleteOpening = (id) => {
    setOpenings(prev => prev.filter(o => o.id !== id))
    if (selectedOpeningId === id) {
      setSelectedOpeningId(null)
    }
  }

  // Update opening eigenschap
  const handleUpdateOpening = (id, field, value) => {
    setOpenings(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  // Start plaatsingsmodus voor een meubel
  const handleAddCabinet = (mod) => {
    setPlacingCabinet({
      code: mod.code,
      type: mod.type,
      width: mod.width,
      height: mod.height,
      depth: mod.depth,
      price: mod.price || 0
    })
  }

  // Bevestig plaatsing van het meubel op een specifieke wall en offset
  const handleConfirmPlacement = (wallId, offset) => {
    if (!placingCabinet) return

    const newCabinet = {
      id: Date.now().toString(),
      code: placingCabinet.code,
      type: placingCabinet.type,
      width: placingCabinet.width,
      height: placingCabinet.height,
      depth: placingCabinet.depth,
      wall: wallId,
      offset: offset,
      price: placingCabinet.price || 0
    }

    setCabinets(prev => [...prev, newCabinet])
    setPlacingCabinet(null)
    setHoveredWallId(null)
  }

  // Live totaalprijs op basis van alle geplaatste kasten
  const totalPrice = cabinets.reduce((sum, c) => sum + (c.price || 0), 0)

  // Verwijder kast
  const handleDeleteCabinet = (id) => {
    setCabinets(prev => prev.filter(c => c.id !== id))
    if (selectedCabinetId === id) {
      setSelectedCabinetId(null)
    }
  }

  // Update kast offset of wall (bijv bij slepen)
  const handleUpdateCabinetPos = (id, wallId, offset) => {
    setCabinets(prev => prev.map(c => c.id === id ? { ...c, wall: wallId, offset } : c))
  }

  // Reset het ontwerp
  const handleReset = () => {
    setCabinets([])
    setOpenings([])
    setSelectedCabinetId(null)
    setPlacingCabinet(null)
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar
        cabinets={cabinets}
        openings={openings}
        onAddCabinet={handleAddCabinet}
        onDeleteCabinet={handleDeleteCabinet}
        selectedCabinetId={selectedCabinetId}
        onSelectCabinet={setSelectedCabinetId}
        selectedMaterial={selectedMaterial}
        onSelectMaterial={setSelectedMaterial}
        onReset={handleReset}
        roomShape={roomShape}
        onSelectRoomShape={setRoomShape}
        wallLengths={wallLengths}
        onUpdateWallLengths={setWallLengths}
        onAddOpening={handleAddOpening}
        onDeleteOpening={handleDeleteOpening}
        onUpdateOpening={handleUpdateOpening}
        placingCabinet={placingCabinet}
        onCancelPlacement={() => setPlacingCabinet(null)}
        onUpdateCabinetPos={handleUpdateCabinetPos}
        floorType={floorType}
        onSelectFloorType={setFloorType}
      />

      {/* Main split-screen: 3D View links en 2D Plattegrond rechts */}
      <main className="main-content">
{/* 3D Scene */}
         <ThreeDView
           cabinets={cabinetsWithTransforms}
           openings={openings}
           selectedCabinetId={selectedCabinetId}
           onSelectCabinet={setSelectedCabinetId}
           selectedOpeningId={selectedOpeningId}
           onSelectOpening={setSelectedOpeningId}
           selectedMaterial={selectedMaterial}
           wallDimensions={wallLengths}
           roomShape={roomShape}
           hoveredWallId={hoveredWallId}
           hoveredOffset={hoveredOffset}
           floorType={floorType}
           draggingId={draggingId}
           showAxes={showAxes}
         />

{/* 2D Plattegrond */}
         <TwoDView
           cabinets={cabinets}
           openings={openings}
           selectedCabinetId={selectedCabinetId}
           onSelectCabinet={setSelectedCabinetId}
           selectedOpeningId={selectedOpeningId}
           onSelectOpening={setSelectedOpeningId}
           wallDimensions={wallLengths}
           roomShape={roomShape}
           placingCabinet={placingCabinet}
           onConfirmPlacement={handleConfirmPlacement}
           onUpdateCabinetPos={handleUpdateCabinetPos}
           hoveredWallId={hoveredWallId}
           hoveredOffset={hoveredOffset}
           onUpdateHoverPos={(wallId, offset) => {
             setHoveredWallId(wallId)
             setHoveredOffset(offset)
           }}
           onDraggingChange={setDraggingId}
           onDeleteCabinet={handleDeleteCabinet}
           onAddCabinet={handleAddCabinet}
           onDeleteOpening={handleDeleteOpening}
           totalPrice={totalPrice}
           showAxes={showAxes}
           onToggleAxes={() => setShowAxes(prev => !prev)}
         />
      </main>
    </div>
  )
}
