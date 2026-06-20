import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ThreeDView from './components/ThreeDView'
import TwoDView from './components/TwoDView'

// Helper om kasten netjes uit te lijnen langs de L-muren (rechterwand en achterwand)
function relayoutCabinets(cabList) {
  // Splits kasten op basis van wand en type (onder/hoge kasten vs bovenkasten)
  const rightBase = cabList.filter(c => c.wall === 'right' && !c.type.startsWith('wall'))
  const rightWall = cabList.filter(c => c.wall === 'right' && c.type.startsWith('wall'))
  
  const backBase = cabList.filter(c => c.wall === 'back' && !c.type.startsWith('wall'))
  const backWall = cabList.filter(c => c.wall === 'back' && c.type.startsWith('wall'))

  // 1. Rechterwand (loopt langs Z-as van 0 naar 4.74)
  let currentZ = 0
  const updatedRightBase = rightBase.map(c => {
    const z = currentZ + c.width / 2
    currentZ += c.width
    const y = c.type === 'tall' ? 1.0 : 0.5
    return {
      ...c,
      position: [-c.depth / 2, y, z]
    }
  })

  // Bovenkasten rechterwand (beginnen na de eerste hoge kast indien aanwezig)
  const startsWithTall = updatedRightBase.length > 0 && updatedRightBase[0].type === 'tall'
  let currentWallZ = startsWithTall ? updatedRightBase[0].width : 0
  const updatedRightWall = rightWall.map(c => {
    const z = currentWallZ + c.width / 2
    currentWallZ += c.width
    return {
      ...c,
      position: [-c.depth / 2, 1.55, z]
    }
  })

  // 2. Achterwand (loopt langs X-as naar links, dus negatieve X van 0 naar -4.0)
  let currentX = 0
  const updatedBackBase = backBase.map(c => {
    const x = currentX - c.width / 2
    currentX -= c.width
    const y = c.type === 'tall' ? 1.0 : 0.5
    return {
      ...c,
      position: [x, y, c.depth / 2]
    }
  })

  let currentBackWallX = 0
  const updatedBackWall = backWall.map(c => {
    const x = currentBackWallX - c.width / 2
    currentBackWallX -= c.width
    return {
      ...c,
      position: [x, 1.55, c.depth / 2]
    }
  })

  return [
    ...updatedRightBase,
    ...updatedRightWall,
    ...updatedBackBase,
    ...updatedBackWall
  ]
}

const DEFAULT_CABINETS = [
  { id: '1', code: 'G88', type: 'tall', width: 0.6, height: 2.0, depth: 0.6, wall: 'right' },
  { id: '2', code: 'SPUD80', type: 'base_sink', width: 0.8, height: 0.8, depth: 0.6, wall: 'right' },
  { id: '3', code: 'GSB60-I', type: 'base_dishwasher', width: 0.6, height: 0.8, depth: 0.6, wall: 'right' },
  { id: '4', code: 'SPUD60', type: 'base_sink', width: 0.6, height: 0.8, depth: 0.6, wall: 'right' },
  { id: '5', code: 'UD60', type: 'base_door', width: 0.6, height: 0.8, depth: 0.6, wall: 'right' },
  { id: '6', code: 'KA60', type: 'base_drawer', width: 0.6, height: 0.8, depth: 0.6, wall: 'right' },
  { id: '7', code: 'UA60', type: 'base_drawer', width: 0.6, height: 0.8, depth: 0.6, wall: 'right' },
  { id: '8', code: 'W60-3', type: 'wall', width: 0.6, height: 0.7, depth: 0.35, wall: 'right' },
  { id: '9', code: 'WDAF60-3', type: 'wall_extractor', width: 0.6, height: 0.7, depth: 0.35, wall: 'right' },
  { id: '10', code: 'W60-3', type: 'wall', width: 0.6, height: 0.7, depth: 0.35, wall: 'right' },
]

const DEFAULT_MATERIAL = { 
  id: 'natural_oak', 
  name: 'Natuurlijk Eiken', 
  color: '#bfa37a', 
  roughness: 0.5, 
  previewColor: '#cfa976' 
}

export default function App() {
  const [cabinets, setCabinets] = useState(() => relayoutCabinets(DEFAULT_CABINETS))
  const [selectedCabinetId, setSelectedCabinetId] = useState(null)
  const [selectedMaterial, setSelectedMaterial] = useState(DEFAULT_MATERIAL)
  const [wallDimensions] = useState({ back: 4.0, right: 4.74 })

  // Voeg een nieuwe kast toe
  const handleAddCabinet = (mod) => {
    const newCabinet = {
      id: Date.now().toString(),
      code: mod.code,
      type: mod.type,
      width: mod.width,
      height: mod.height,
      depth: mod.depth,
      // Bovenkasten gaan automatisch op de rechterwand boven de onderkasten,
      // overige kasten gaan standaard op de rechterwand
      wall: 'right',
      position: [0, 0, 0]
    }

    // Bereken de nieuwe opstelling
    setCabinets(prev => {
      const updated = [...prev, newCabinet]
      return relayoutCabinets(updated)
    })
  }

  // Verwijder een kast uit het ontwerp
  const handleDeleteCabinet = (id) => {
    setCabinets(prev => {
      const filtered = prev.filter(c => c.id !== id)
      return relayoutCabinets(filtered)
    })
    if (selectedCabinetId === id) {
      setSelectedCabinetId(null)
    }
  }

  // Selecteer kast
  const handleSelectCabinet = (id) => {
    setSelectedCabinetId(id)
  }

  // Selecteer houtmateriaal
  const handleSelectMaterial = (mat) => {
    setSelectedMaterial(mat)
  }

  // Reset het ontwerp
  const handleReset = () => {
    setCabinets([])
    setSelectedCabinetId(null)
  }

  return (
    <div className="app-container">
      {/* Linker/Rechter Sidebar voor Kodiak logo en opties */}
      <Sidebar 
        cabinets={cabinets}
        onAddCabinet={handleAddCabinet}
        onDeleteCabinet={handleDeleteCabinet}
        selectedCabinetId={selectedCabinetId}
        onSelectCabinet={handleSelectCabinet}
        selectedMaterial={selectedMaterial}
        onSelectMaterial={handleSelectMaterial}
        onReset={handleReset}
      />

      {/* Main split-screen: 3D View links en 2D Plattegrond rechts */}
      <main className="main-content">
        {/* 3D Scene */}
        <ThreeDView 
          cabinets={cabinets}
          selectedCabinetId={selectedCabinetId}
          onSelectCabinet={handleSelectCabinet}
          selectedMaterial={selectedMaterial}
          wallDimensions={wallDimensions}
        />

        {/* 2D Plattegrond */}
        <TwoDView 
          cabinets={cabinets}
          selectedCabinetId={selectedCabinetId}
          onSelectCabinet={handleSelectCabinet}
          wallDimensions={wallDimensions}
        />
      </main>
    </div>
  )
}
