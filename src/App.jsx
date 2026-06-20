import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ThreeDView from './components/ThreeDView'
import TwoDView from './components/TwoDView'
import { getWalls, getCabinetTransform } from './utils/geometry'

const DEFAULT_CABINETS = [
  { id: '1', code: 'G88', type: 'tall', width: 0.6, height: 2.0, depth: 0.6, wall: 'right', offset: 0.3 },
  { id: '2', code: 'SPUD80', type: 'base_sink', width: 0.8, height: 0.8, depth: 0.6, wall: 'right', offset: 1.0 },
  { id: '3', code: 'GSB60-I', type: 'base_dishwasher', width: 0.6, height: 0.8, depth: 0.6, wall: 'right', offset: 1.7 },
  { id: '4', code: 'SPUD60', type: 'base_sink', width: 0.6, height: 0.8, depth: 0.6, wall: 'right', offset: 2.3 },
  { id: '5', code: 'UD60', type: 'base_door', width: 0.6, height: 0.8, depth: 0.6, wall: 'right', offset: 2.9 },
  { id: '6', code: 'KA60', type: 'base_drawer', width: 0.6, height: 0.8, depth: 0.6, wall: 'right', offset: 3.5 },
  { id: '7', code: 'UA60', type: 'base_drawer', width: 0.6, height: 0.8, depth: 0.6, wall: 'right', offset: 4.1 },
  { id: '8', code: 'W60-3', type: 'wall', width: 0.6, height: 0.7, depth: 0.35, wall: 'right', offset: 2.9 },
  { id: '9', code: 'WDAF60-3', type: 'wall_extractor', width: 0.6, height: 0.7, depth: 0.35, wall: 'right', offset: 3.5 },
  { id: '10', code: 'W60-3', type: 'wall', width: 0.6, height: 0.7, depth: 0.35, wall: 'right', offset: 4.1 },
]

const DEFAULT_MATERIAL = { 
  id: 'natural_oak', 
  name: 'Natuurlijk Eiken', 
  color: '#bfa37a', 
  roughness: 0.5, 
  previewColor: '#cfa976' 
}

const DEFAULT_OPENINGS = [
  { id: 'o1', type: 'window', wall: 'back', offset: 2.0, width: 1.2, height: 1.2, sillHeight: 0.9 },
  { id: 'o2', type: 'door', wall: 'right', offset: 4.5, width: 0.8, height: 2.0 }
]

export default function App() {
  const [roomShape, setRoomShape] = useState('L-shape') // 'straight' | 'L-shape' | 'U-shape'
  const [wallLengths, setWallLengths] = useState({ back: 4.0, right: 4.74, left: 3.0 })
  const [cabinets, setCabinets] = useState(DEFAULT_CABINETS)
  const [openings, setOpenings] = useState(DEFAULT_OPENINGS)
  const [selectedCabinetId, setSelectedCabinetId] = useState(null)
  const [selectedMaterial, setSelectedMaterial] = useState(DEFAULT_MATERIAL)
  
  // Placement / drag states
  const [placingCabinet, setPlacingCabinet] = useState(null) // cabinet data being placed
  const [hoveredWallId, setHoveredWallId] = useState(null)
  const [hoveredOffset, setHoveredOffset] = useState(0)

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
      depth: mod.depth
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
      offset: offset
    }

    setCabinets(prev => [...prev, newCabinet])
    setPlacingCabinet(null)
    setHoveredWallId(null)
  }

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
      />

      {/* Main split-screen: 3D View links en 2D Plattegrond rechts */}
      <main className="main-content">
        {/* 3D Scene */}
        <ThreeDView 
          cabinets={cabinetsWithTransforms}
          openings={openings}
          selectedCabinetId={selectedCabinetId}
          onSelectCabinet={setSelectedCabinetId}
          selectedMaterial={selectedMaterial}
          wallDimensions={wallLengths}
          roomShape={roomShape}
          placingCabinet={placingCabinet}
          hoveredWallId={hoveredWallId}
          hoveredOffset={hoveredOffset}
        />

        {/* 2D Plattegrond */}
        <TwoDView 
          cabinets={cabinets}
          openings={openings}
          selectedCabinetId={selectedCabinetId}
          onSelectCabinet={setSelectedCabinetId}
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
        />
      </main>
    </div>
  )
}
