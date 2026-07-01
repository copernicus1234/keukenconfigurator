import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ThreeDView from './components/ThreeDView'
import TwoDView from './components/TwoDView'
import { getWalls, getCabinetTransform } from './utils/geometry'

const DEFAULT_MATERIAL = {
  id: 'natural_oak',
  name: 'Natuurlijk Eiken',
  color: '#bfa37a',
  roughness: 0.5,
  previewColor: '#cfa976'
}

export default function App() {
  const [roomShape, setRoomShape] = useState('L-shape') // 'straight' | 'L-shape' | 'U-shape'
  const [wallLengths, setWallLengths] = useState({ back: 4.0, right: 4.74, left: 3.0 })
  const [cabinets, setCabinets] = useState([])
  const [openings, setOpenings] = useState([])
  const [selectedCabinetId, setSelectedCabinetId] = useState(null)
  const [selectedOpeningId, setSelectedOpeningId] = useState(null)
  const [selectedMaterial, setSelectedMaterial] = useState(DEFAULT_MATERIAL)
  const [floorType, setFloorType] = useState('wood') // 'tiles' | 'wood'

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
        totalPrice={totalPrice}
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
onDeleteCabinet={handleDeleteCabinet}
            onAddCabinet={handleAddCabinet}
            onDeleteOpening={handleDeleteOpening}
          />
      </main>
    </div>
  )
}
