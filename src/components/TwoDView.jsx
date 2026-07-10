import { useState, useRef, useCallback } from 'react'
import { getWalls, getClosestWallAndOffset, getSnappedOffsetWithLength } from '../utils/geometry'

const SCALE = 70        // pixels per meter
const WALL_THICK = 10   // px wall thickness
const SVG_W = 520
const SVG_H = 520
const ORIGIN_X = 430    // SVG origin = room corner (right wall meets back wall)
const ORIGIN_Y = 60     // SVG origin Y

const WALL_LABELS = { back: 'Achterwand', right: 'Rechterwand', left: 'Linkerwand' }

// Convert 3D room coords (x,z) → SVG coords
// In 3D: x goes negative (back wall), z goes positive (right wall)
// In SVG: positive x goes right, positive y goes down
function toSvg(rx, rz) {
  return {
    sx: ORIGIN_X + rx * SCALE,   // rx is negative → goes left
    sy: ORIGIN_Y + rz * SCALE,   // rz is positive → goes down
  }
}

// Draw a dimension line in SVG
function DimLine({ x1, y1, x2, y2, label, offset = 20, vertical = false }) {
  if (vertical) {
    const cx = (x1 + x2) / 2 + offset
    return (
      <g>
        <line x1={cx} y1={y1} x2={cx} y2={y2} stroke="#8c887d" strokeWidth="1" />
        <line x1={cx - 4} y1={y1} x2={cx + 4} y2={y1} stroke="#8c887d" strokeWidth="1.5" />
        <line x1={cx - 4} y1={y2} x2={cx + 4} y2={y2} stroke="#8c887d" strokeWidth="1.5" />
        <rect x={cx - 18} y={(y1 + y2) / 2 - 9} width="36" height="18" fill="#fdfdfc" rx="4" />
        <text x={cx} y={(y1 + y2) / 2} fontSize="10" fontWeight="600" fill="#2c2b29" textAnchor="middle" dominantBaseline="middle">
          {label}
        </text>
      </g>
    )
  }
  const cy = (y1 + y2) / 2 - offset
  return (
    <g>
      <line x1={x1} y1={cy} x2={x2} y2={cy} stroke="#8c887d" strokeWidth="1" />
      <line x1={x1} y1={cy - 4} x2={x1} y2={cy + 4} stroke="#8c887d" strokeWidth="1.5" />
      <line x1={x2} y1={cy - 4} x2={x2} y2={cy + 4} stroke="#8c887d" strokeWidth="1.5" />
      <rect x={(x1 + x2) / 2 - 22} y={cy - 9} width="44" height="18" fill="#fdfdfc" rx="4" />
      <text x={(x1 + x2) / 2} y={cy} fontSize="10" fontWeight="600" fill="#2c2b29" textAnchor="middle" dominantBaseline="middle">
        {label}
      </text>
    </g>
  )
}

// Draw a cabinet rectangle in SVG given wall geometry and offset
function CabinetRect({ cab, wall, isSelected, onSelect, onDeleteCabinet, onAddCabinet }) {
  const isWallCab = cab.type.startsWith('wall')
  const isCorner = cab.type === 'corner_L' || cab.type === 'wall_corner_L'
  const widthPx = cab.width * SCALE
  const depthPx = (isWallCab ? 0.35 : cab.depth) * SCALE

  // Direction vector of wall in SVG space
  const dsx = (wall.x2 - wall.x1) / wall.length
  const dsz = (wall.z2 - wall.z1) / wall.length

  // Center position along wall
  const cx3 = wall.x1 + dsx * cab.offset
  const cz3 = wall.z1 + dsz * cab.offset
  const { sx: cx, sy: cy } = toSvg(cx3, cz3)

  let pts = ""
  let lx = 0
  let ly = 0

  if (isCorner) {
    const isLeftCorner = cab.wall !== 'back' || cab.offset <= wall.length / 2
    const size = cab.width || 0.9
    const edge = cab.type === 'wall_corner_L' ? 0.35 : 0.6
    const halfS = size / 2
    const offsetDiff = edge - halfS
    const cutStart = edge - halfS

    const localPts = isLeftCorner
      ? [
        [-halfS, -halfS],
        [halfS, -halfS],
        [halfS, offsetDiff],
        [cutStart, offsetDiff],
        [cutStart, halfS],
        [-halfS, halfS]
      ]
      : [
        [halfS, -halfS],
        [-halfS, -halfS],
        [-halfS, offsetDiff],
        [-cutStart, offsetDiff],
        [-cutStart, halfS],
        [halfS, halfS]
      ]

    const worldPts = localPts.map(([localX, localZ]) => {
      const wx = wall.x1 + (cab.offset + localX) * dsx + (localZ + halfS) * wall.normalX
      const wz = wall.z1 + (cab.offset + localX) * dsz + (localZ + halfS) * wall.normalZ
      return toSvg(wx, wz)
    })

    pts = worldPts.map(({ sx, sy }) => `${sx},${sy}`).join(' ')
    lx = worldPts.reduce((s, p) => s + p.sx, 0) / 6
    ly = worldPts.reduce((s, p) => s + p.sy, 0) / 6
  } else {
    // Half-extents for the rect: along-wall and into-room
    const halfW = widthPx / 2
    // Four corners: start from wall surface, go inward by depth
    const corners = [
      [cx - halfW * dsx, cy - halfW * dsz],      // along-wall start, at wall surface
      [cx + halfW * dsx, cy + halfW * dsz],      // along-wall end, at wall surface
      [cx + halfW * dsx + depthPx * wall.normalX,
      cy + halfW * dsz + depthPx * wall.normalZ],   // along-wall end, into room
      [cx - halfW * dsx + depthPx * wall.normalX,
      cy - halfW * dsz + depthPx * wall.normalZ],   // along-wall start, into room
    ]
    pts = corners.map(([x, y]) => `${x},${y}`).join(' ')
    lx = corners.reduce((s, c) => s + c[0], 0) / 4
    ly = corners.reduce((s, c) => s + c[1], 0) / 4
  }

  const fill = isSelected
    ? '#f5ede0'
    : isWallCab
      ? 'none'
      : cab.type === 'tall' ? '#eae6dc' : '#f5f4f0'

  const stroke = isSelected ? '#826242' : isWallCab ? '#8c887d' : '#2c2b29'

  // Angle for rotated text along wall
  const angle = Math.atan2(dsz, dsx) * 180 / Math.PI

  // Position for action buttons (+/-) near the front edge
  const btnOffset = depthPx + 20
  const btnX = cx + btnOffset * wall.normalX
  const btnY = cy + btnOffset * wall.normalZ

  // Drawer lines
  const drawerLines = []
  if (cab.isOpen) {
    const isDouble = cab.width >= 0.8
    const isDrawer = cab.type === 'drawers' || cab.type === 'base_drawer'
    const isDoor = ['door', 'sink', 'tall', 'wall', 'wall_extractor'].includes(cab.type)
    const halfW = widthPx / 2

    if (isDrawer) {
      const slideDistPx = 25
      const frontX_start = cx - halfW * dsx + (depthPx + slideDistPx) * wall.normalX
      const frontY_start = cy - halfW * dsz + (depthPx + slideDistPx) * wall.normalZ
      const frontX_end = cx + halfW * dsx + (depthPx + slideDistPx) * wall.normalX
      const frontY_end = cy + halfW * dsz + (depthPx + slideDistPx) * wall.normalZ

      const carcassX_start = cx - halfW * dsx + depthPx * wall.normalX
      const carcassY_start = cy - halfW * dsz + depthPx * wall.normalZ
      const carcassX_end = cx + halfW * dsx + depthPx * wall.normalX
      const carcassY_end = cy + halfW * dsz + depthPx * wall.normalZ

      drawerLines.push(
        <line
          key="open_drawer_front"
          x1={frontX_start}
          y1={frontY_start}
          x2={frontX_end}
          y2={frontY_end}
          stroke="#2c2b29"
          strokeWidth="2"
        />,
        <line
          key="drawer_slide_l"
          x1={carcassX_start}
          y1={carcassY_start}
          x2={frontX_start}
          y2={frontY_start}
          stroke="#8c887d"
          strokeWidth="1.5"
          strokeDasharray="3,3"
        />,
        <line
          key="drawer_slide_r"
          x1={carcassX_end}
          y1={carcassY_end}
          x2={frontX_end}
          y2={frontY_end}
          stroke="#8c887d"
          strokeWidth="1.5"
          strokeDasharray="3,3"
        />
      )
    } else if (isDoor) {
      const hingeX_l = cx - halfW * dsx + depthPx * wall.normalX
      const hingeY_l = cy - halfW * dsz + depthPx * wall.normalZ
      const phi = Math.PI / 4
      const cosPhi = Math.cos(phi)
      const sinPhi = Math.sin(phi)

      if (isDouble) {
        const halfW_px = widthPx / 2
        const doorEndX_l = hingeX_l + halfW_px * (cosPhi * dsx + sinPhi * wall.normalX)
        const doorEndY_l = hingeY_l + halfW_px * (cosPhi * dsz + sinPhi * wall.normalZ)

        const hingeX_r = cx + halfW * dsx + depthPx * wall.normalX
        const hingeY_r = cy + halfW * dsz + depthPx * wall.normalZ
        const doorEndX_r = hingeX_r + halfW_px * (-cosPhi * dsx + sinPhi * wall.normalX)
        const doorEndY_r = hingeY_r + halfW_px * (-cosPhi * dsz + sinPhi * wall.normalZ)

        const closedEndX_l = hingeX_l + halfW_px * dsx
        const closedEndY_l = hingeY_l + halfW_px * dsz
        const closedEndX_r = hingeX_r - halfW_px * dsx
        const closedEndY_r = hingeY_r - halfW_px * dsz

        const cross = dsx * wall.normalZ - dsz * wall.normalX
        const sweepFlag = cross > 0 ? 1 : 0
        const sweepFlag_r = sweepFlag === 1 ? 0 : 1

        const arcPath_l = `M ${closedEndX_l},${closedEndY_l} A ${halfW_px},${halfW_px} 0 0,${sweepFlag} ${doorEndX_l},${doorEndY_l}`
        const arcPath_r = `M ${closedEndX_r},${closedEndY_r} A ${halfW_px},${halfW_px} 0 0,${sweepFlag_r} ${doorEndX_r},${doorEndY_r}`

        drawerLines.push(
          <line key="open_door_l" x1={hingeX_l} y1={hingeY_l} x2={doorEndX_l} y2={doorEndY_l} stroke="#2c2b29" strokeWidth="2" />,
          <path key="open_door_arc_l" d={arcPath_l} fill="none" stroke="#8c887d" strokeWidth="1.5" strokeDasharray="2,2" />,
          <line key="open_door_r" x1={hingeX_r} y1={hingeY_r} x2={doorEndX_r} y2={doorEndY_r} stroke="#2c2b29" strokeWidth="2" />,
          <path key="open_door_arc_r" d={arcPath_r} fill="none" stroke="#8c887d" strokeWidth="1.5" strokeDasharray="2,2" />
        )
      } else {
        const doorEndX = hingeX_l + widthPx * (cosPhi * dsx + sinPhi * wall.normalX)
        const doorEndY = hingeY_l + widthPx * (cosPhi * dsz + sinPhi * wall.normalZ)

        const closedEndX = hingeX_l + widthPx * dsx
        const closedEndY = hingeY_l + widthPx * dsz

        const cross = dsx * wall.normalZ - dsz * wall.normalX
        const sweepFlag = cross > 0 ? 1 : 0
        const arcPath = `M ${closedEndX},${closedEndY} A ${widthPx},${widthPx} 0 0,${sweepFlag} ${doorEndX},${doorEndY}`

        drawerLines.push(
          <line key="open_door" x1={hingeX_l} y1={hingeY_l} x2={doorEndX} y2={doorEndY} stroke="#2c2b29" strokeWidth="2" />,
          <path key="open_door_arc" d={arcPath} fill="none" stroke="#8c887d" strokeWidth="1.5" strokeDasharray="2,2" />
        )
      }
    }
  } else {
    if (cab.type === 'drawers' || cab.type === 'base_drawer') {
      const d1 = depthPx * 0.33
      const d2 = depthPx * 0.66
      const halfW = widthPx / 2
      drawerLines.push(
        <line
          key="d1"
          x1={cx - halfW * dsx + d1 * wall.normalX}
          y1={cy - halfW * dsz + d1 * wall.normalZ}
          x2={cx + halfW * dsx + d1 * wall.normalX}
          y2={cy + halfW * dsz + d1 * wall.normalZ}
          stroke="#a6a297"
          strokeWidth="1"
          strokeDasharray="2,2"
        />,
        <line
          key="d2"
          x1={cx - halfW * dsx + d2 * wall.normalX}
          y1={cy - halfW * dsz + d2 * wall.normalZ}
          x2={cx + halfW * dsx + d2 * wall.normalX}
          y2={cy + halfW * dsz + d2 * wall.normalZ}
          stroke="#a6a297"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
      )
    } else if (cab.type === 'open_shelf') {
      const dShelf = depthPx * 0.5
      const halfW = widthPx / 2
      drawerLines.push(
        <line
          key="shelf"
          x1={cx - halfW * dsx + dShelf * wall.normalX}
          y1={cy - halfW * dsz + dShelf * wall.normalZ}
          x2={cx + halfW * dsx + dShelf * wall.normalX}
          y2={cy + halfW * dsz + dShelf * wall.normalZ}
          stroke="#a6a297"
          strokeWidth="1.5"
          strokeDasharray="4,4"
        />
      )

      if (cab.code === 'ME104') {
        const hingeX = cx - halfW * dsx + depthPx * wall.normalX
        const hingeY = cy - halfW * dsz + depthPx * wall.normalZ

        const phi = Math.PI / 4
        const cosPhi = Math.cos(phi)
        const sinPhi = Math.sin(phi)

        const doorEndX = hingeX + widthPx * (cosPhi * dsx + sinPhi * wall.normalX)
        const doorEndY = hingeY + widthPx * (cosPhi * dsz + sinPhi * wall.normalZ)

        drawerLines.push(
          <line
            key="open_door"
            x1={hingeX}
            y1={hingeY}
            x2={doorEndX}
            y2={doorEndY}
            stroke="#2c2b29"
            strokeWidth="2"
          />
        )

        const closedEndX = hingeX + widthPx * dsx
        const closedEndY = hingeY + widthPx * dsz

        const cross = dsx * wall.normalZ - dsz * wall.normalX
        const sweepFlag = cross > 0 ? 1 : 0

        const arcPath = `M ${closedEndX},${closedEndY} A ${widthPx},${widthPx} 0 0,${sweepFlag} ${doorEndX},${doorEndY}`

        drawerLines.push(
          <path
            key="open_door_arc"
            d={arcPath}
            fill="none"
            stroke="#8c887d"
            strokeWidth="1.5"
            strokeDasharray="2,2"
          />
        )
      }
    }
  }

  // Handles
  const handleElements = []
  const halfW = widthPx / 2
  const handleColor = isSelected ? '#826242' : '#8c887d'

  if (cab.isOpen) {
    const isDouble = cab.width >= 0.8
    const isDrawer = cab.type === 'drawers' || cab.type === 'base_drawer'
    
    if (isDrawer) {
      const slideDistPx = 25
      const fc_x = cx + (depthPx + slideDistPx) * wall.normalX
      const fc_y = cy + (depthPx + slideDistPx) * wall.normalZ
      handleElements.push(
        <line
          key="h-drawer-open"
          x1={fc_x - 10 * dsx + 1.5 * wall.normalX}
          y1={fc_y - 10 * dsz + 1.5 * wall.normalZ}
          x2={fc_x + 10 * dsx + 1.5 * wall.normalX}
          y2={fc_y + 10 * dsz + 1.5 * wall.normalZ}
          stroke={handleColor}
          strokeWidth="2"
        />
      )
    } else if (cab.type !== 'base_dishwasher' && cab.type !== 'open_shelf') {
      const hingeX_l = cx - halfW * dsx + depthPx * wall.normalX
      const hingeY_l = cy - halfW * dsz + depthPx * wall.normalZ
      const phi = Math.PI / 4
      const cosPhi = Math.cos(phi)
      const sinPhi = Math.sin(phi)
      
      if (isDouble) {
        const handleDist = (widthPx / 2) * 0.8
        const handleStartX_l = hingeX_l + handleDist * (cosPhi * dsx + sinPhi * wall.normalX)
        const handleStartY_l = hingeY_l + handleDist * (cosPhi * dsz + sinPhi * wall.normalZ)
        const handleDirX_l = -sinPhi * dsx + cosPhi * wall.normalX
        const handleDirY_l = -sinPhi * dsz + cosPhi * wall.normalZ
        
        const hingeX_r = cx + halfW * dsx + depthPx * wall.normalX
        const hingeY_r = cy + halfW * dsz + depthPx * wall.normalZ
        const handleStartX_r = hingeX_r + handleDist * (-cosPhi * dsx + sinPhi * wall.normalX)
        const handleStartY_r = hingeY_r + handleDist * (-cosPhi * dsz + sinPhi * wall.normalZ)
        const handleDirX_r = sinPhi * dsx + cosPhi * wall.normalX
        const handleDirY_r = sinPhi * dsz + cosPhi * wall.normalZ
        
        handleElements.push(
          <line
            key="h-open-door-l"
            x1={handleStartX_l}
            y1={handleStartY_l}
            x2={handleStartX_l + 4 * handleDirX_l}
            y2={handleStartY_l + 4 * handleDirY_l}
            stroke={handleColor}
            strokeWidth="2"
          />,
          <line
            key="h-open-door-r"
            x1={handleStartX_r}
            y1={handleStartY_r}
            x2={handleStartX_r + 4 * handleDirX_r}
            y2={handleStartY_r + 4 * handleDirY_r}
            stroke={handleColor}
            strokeWidth="2"
          />
        )
      } else {
        const handleDist = widthPx * 0.8
        const handleStartX = hingeX_l + handleDist * (cosPhi * dsx + sinPhi * wall.normalX)
        const handleStartY = hingeY_l + handleDist * (cosPhi * dsz + sinPhi * wall.normalZ)
        const handleDirX = -sinPhi * dsx + cosPhi * wall.normalX
        const handleDirY = -sinPhi * dsz + cosPhi * wall.normalZ
        const handleEndX = handleStartX + 4 * handleDirX
        const handleEndY = handleStartY + 4 * handleDirY
        
        handleElements.push(
          <line
            key="h-open-door"
            x1={handleStartX}
            y1={handleStartY}
            x2={handleEndX}
            y2={handleEndY}
            stroke={handleColor}
            strokeWidth="2"
          />
        )
      }
    }
  } else {
    if (isCorner) {
      const isLeftCorner = cab.wall !== 'back' || cab.offset <= wall.length / 2
      const size = cab.width || 0.9
      const edge = cab.type === 'wall_corner_L' ? 0.35 : 0.6
      const halfS = size / 2
      const hx_local = isLeftCorner ? (edge - halfS) : -(edge - halfS)
      const hz_local = edge - halfS
      const hwx = wall.x1 + (cab.offset + hx_local) * dsx + (hz_local + halfS) * wall.normalX
      const hwz = wall.z1 + (cab.offset + hx_local) * dsz + (hz_local + halfS) * wall.normalZ
      const { sx: hcx, sy: hcy } = toSvg(hwx, hwz)

      handleElements.push(
        <line
          key="h1"
          x1={hcx}
          y1={hcy}
          x2={hcx + 6 * wall.normalX}
          y2={hcy + 6 * wall.normalZ}
          stroke={handleColor}
          strokeWidth="1.5"
        />,
        <line
          key="h2"
          x1={hcx}
          y1={hcy}
          x2={hcx - 6 * dsx}
          y2={hcy - 6 * dsz}
          stroke={handleColor}
          strokeWidth="1.5"
        />
      )
    } else if (cab.type === 'drawers' || cab.type === 'base_drawer') {
      const fc_x = cx + depthPx * wall.normalX
      const fc_y = cy + depthPx * wall.normalZ
      handleElements.push(
        <line
          key="h-drawer"
          x1={fc_x - 10 * dsx + 1.5 * wall.normalX}
          y1={fc_y - 10 * dsz + 1.5 * wall.normalZ}
          x2={fc_x + 10 * dsx + 1.5 * wall.normalX}
          y2={fc_y + 10 * dsz + 1.5 * wall.normalZ}
          stroke={handleColor}
          strokeWidth="2"
        />
      )
    } else {
      const isDouble = cab.width >= 0.8
      const fc_x = cx + depthPx * wall.normalX
      const fc_y = cy + depthPx * wall.normalZ

      if (isDouble) {
        handleElements.push(
          <line
            key="h-double-l"
            x1={fc_x - 3 * dsx}
            y1={fc_y - 3 * dsz}
            x2={fc_x - 3 * dsx + 5 * wall.normalX}
            y2={fc_y - 3 * dsz + 5 * wall.normalZ}
            stroke={handleColor}
            strokeWidth="1.5"
          />,
          <line
            key="h-double-r"
            x1={fc_x + 3 * dsx}
            y1={fc_y + 3 * dsz}
            x2={fc_x + 3 * dsx + 5 * wall.normalX}
            y2={fc_y + 3 * dsz + 5 * wall.normalZ}
            stroke={handleColor}
            strokeWidth="1.5"
          />
        )
      } else if (cab.type !== 'base_dishwasher' && cab.type !== 'open_shelf') {
        const hc_x = cx + (halfW - 6) * dsx + depthPx * wall.normalX
        const hc_y = cy + (halfW - 6) * dsz + depthPx * wall.normalZ
        handleElements.push(
          <line
            key="h-single"
            x1={hc_x}
            y1={hc_y}
            x2={hc_x + 5 * wall.normalX}
            y2={hc_y + 5 * wall.normalZ}
            stroke={handleColor}
            strokeWidth="1.5"
          />
        )
      }
    }
  }

  if (cab.code === 'ME104') {
    const halfW = widthPx / 2
    const hingeX = cx - halfW * dsx + depthPx * wall.normalX
    const hingeY = cy - halfW * dsz + depthPx * wall.normalZ
    const phi = Math.PI / 4
    const cosPhi = Math.cos(phi)
    const sinPhi = Math.sin(phi)

    const handleDist = widthPx * 0.8
    const handleStartX = hingeX + handleDist * (cosPhi * dsx + sinPhi * wall.normalX)
    const handleStartY = hingeY + handleDist * (cosPhi * dsz + sinPhi * wall.normalZ)

    const handleDirX = -sinPhi * dsx + cosPhi * wall.normalX
    const handleDirY = -sinPhi * dsz + cosPhi * wall.normalZ

    const handleEndX = handleStartX + 4 * handleDirX
    const handleEndY = handleStartY + 4 * handleDirY

    handleElements.push(
      <line
        key="h-open-door"
        x1={handleStartX}
        y1={handleStartY}
        x2={handleEndX}
        y2={handleEndY}
        stroke={handleColor}
        strokeWidth="2"
      />
    )
  }

  return (
    <g onClick={() => onSelect(cab.id)} style={{ cursor: 'pointer' }}>
      <polygon
        points={pts}
        fill={fill}
        stroke={stroke}
        strokeWidth={isSelected ? 2.5 : 1.5}
        strokeDasharray={isWallCab ? '4,3' : 'none'}
        rx="2"
      />
      {drawerLines}
      {handleElements}
      <text
        x={lx} y={ly}
        fontSize="8"
        fontWeight="700"
        fill={stroke}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${angle}, ${lx}, ${ly})`}
      >
        {cab.code}
      </text>

      {isSelected && onDeleteCabinet && onAddCabinet && (
        <g className="svg-action-buttons" onMouseDown={e => e.stopPropagation()}>
          {/* Delete button (-) */}
          <g
            onClick={(e) => { e.stopPropagation(); onDeleteCabinet(cab.id); }}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={btnX - 16} cy={btnY} r="10" fill="#bf4343" stroke="#ffffff" strokeWidth="1.5" />
            <text x={btnX - 16} y={btnY} fill="#ffffff" fontSize="14" fontWeight="700" textAnchor="middle" dominantBaseline="middle">-</text>
          </g>
          {/* Duplicate button (+) */}
          <g
            onClick={(e) => { e.stopPropagation(); onAddCabinet({ code: cab.code, type: cab.type, width: cab.width, height: cab.height, depth: cab.depth }); }}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={btnX + 16} cy={btnY} r="10" fill="#826242" stroke="#ffffff" strokeWidth="1.5" />
            <text x={btnX + 16} y={btnY} fill="#ffffff" fontSize="12" fontWeight="700" textAnchor="middle" dominantBaseline="middle">+</text>
          </g>
        </g>
      )}
    </g>
  )
}

// Draw a door symbol in SVG
function DoorSymbol({ opening, wall, isSelected, onSelect, onDelete }) {
  const dsx = (wall.x2 - wall.x1) / wall.length
  const dsz = (wall.z2 - wall.z1) / wall.length
  const widthPx = opening.width * SCALE

  const startX3 = wall.x1 + dsx * opening.offset
  const startZ3 = wall.z1 + dsz * opening.offset
  const endX3 = startX3 + dsx * opening.width
  const endZ3 = startZ3 + dsz * opening.width

  const { sx: x1, sy: y1 } = toSvg(startX3, startZ3)
  const { sx: x2, sy: y2 } = toSvg(endX3, endZ3)

  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const btnOffset = 30
  const btnX = cx + btnOffset * wall.normalX
  const btnY = cy + btnOffset * wall.normalZ

  const arcR = widthPx
  // Door swings into room (normal direction)
  const nx = wall.normalX
  const nz = wall.normalZ
  const endArcX = x1 + nx * arcR
  const endArcY = y1 + nz * widthPx

  const stroke = isSelected ? '#826242' : '#826242'
  const strokeWidth = isSelected ? 2.5 : 1.5

  return (
    <g onClick={() => onSelect(opening.id)} style={{ cursor: 'pointer' }}>
      {/* Opening gap */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fdfdfc" strokeWidth="10" />
      {/* Door leaf */}
      <line x1={x1} y1={y1} x2={endArcX} y2={endArcY} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Swing arc */}
      <path
        d={`M ${x2} ${y2} A ${arcR} ${arcR} 0 0 ${nx < 0 || nz > 0 ? 0 : 1} ${endArcX} ${endArcY}`}
        fill="none"
        stroke={stroke}
        strokeWidth="1"
        strokeDasharray="3,2"
      />
      {isSelected && onDelete && (
        <g className="svg-action-buttons" onMouseDown={e => e.stopPropagation()}>
          {/* Delete button (-) */}
          <g
            onClick={(e) => { e.stopPropagation(); onDelete(opening.id); }}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={btnX} cy={btnY} r="10" fill="#bf4343" stroke="#ffffff" strokeWidth="1.5" />
            <text x={btnX} y={btnY} fill="#ffffff" fontSize="14" fontWeight="700" textAnchor="middle" dominantBaseline="middle">-</text>
          </g>
        </g>
      )}
    </g>
  )
}

// Draw a window symbol in SVG
function WindowSymbol({ opening, wall, isSelected, onSelect, onDelete }) {
  const dsx = (wall.x2 - wall.x1) / wall.length
  const dsz = (wall.z2 - wall.z1) / wall.length
  const halfDepthPx = 5

  const startX3 = wall.x1 + dsx * opening.offset
  const startZ3 = wall.z1 + dsz * opening.offset
  const endX3 = startX3 + dsx * opening.width
  const endZ3 = startZ3 + dsz * opening.width

  const { sx: x1, sy: y1 } = toSvg(startX3, startZ3)
  const { sx: x2, sy: y2 } = toSvg(endX3, endZ3)

  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const btnOffset = 30
  const btnX = cx + btnOffset * wall.normalX
  const btnY = cy + btnOffset * wall.normalZ

  const stroke = isSelected ? '#826242' : '#7db8d4'
  const strokeWidth = isSelected ? 2.5 : 2

  const nx = wall.normalX * halfDepthPx
  const nz = wall.normalZ * halfDepthPx

  return (
    <g onClick={() => onSelect(opening.id)} style={{ cursor: 'pointer' }}>
      {/* Opening gap in wall */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fdfdfc" strokeWidth="10" />
      {/* Glass lines (double) */}
      <line x1={x1 + nx * 0.4} y1={y1 + nz * 0.4} x2={x2 + nx * 0.4} y2={y2 + nz * 0.4}
        stroke={stroke} strokeWidth={strokeWidth} />
      <line x1={x1 + nx * 1.0} y1={y1 + nz * 1.0} x2={x2 + nx * 1.0} y2={y2 + nz * 1.0}
        stroke={stroke} strokeWidth={strokeWidth} />
      {isSelected && onDelete && (
        <g className="svg-action-buttons" onMouseDown={e => e.stopPropagation()}>
          {/* Delete button (-) */}
          <g
            onClick={(e) => { e.stopPropagation(); onDelete(opening.id); }}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={btnX} cy={btnY} r="10" fill="#bf4343" stroke="#ffffff" strokeWidth="1.5" />
            <text x={btnX} y={btnY} fill="#ffffff" fontSize="14" fontWeight="700" textAnchor="middle" dominantBaseline="middle">-</text>
          </g>
        </g>
      )}
    </g>
  )
}

// Ghost cabinet preview during placement
function GhostCabinet({ cab, wall, offset }) {
  if (!wall) return null
  const ghost = { ...cab, offset, wall: wall.id }
  return (
    <g opacity="0.55" pointerEvents="none">
      <CabinetRect
        cab={ghost}
        wall={wall}
        isSelected={false}
        onSelect={() => { }}
      />
    </g>
  )
}

export default function TwoDView({
  cabinets,
  openings,
  selectedCabinetId,
  onSelectCabinet,
  selectedOpeningId,
  onSelectOpening,
  wallDimensions,
  roomShape,
  placingCabinet,
  onConfirmPlacement,
  onUpdateCabinetPos,
  onUpdateHoverPos,
  onDeleteCabinet,
  onAddCabinet,
  onDeleteOpening,
  totalPrice = 0,
  onDraggingChange,
  showAxes = false,
  onToggleAxes,
}) {
  const svgRef = useRef(null)
  const [draggingId, setDraggingId] = useState(null)
  const [hoverWall, setHoverWall] = useState(null)
  const [hoverOffset, setHoverOffset] = useState(0)
  const [snapActive, setSnapActive] = useState(false)

  const walls = getWalls(roomShape, wallDimensions)

  // Convert SVG mouse position to 3D room coordinates
  const svgToRoom = useCallback((svgX, svgY) => {
    return {
      rx: (svgX - ORIGIN_X) / SCALE,  // negative = along back wall
      rz: (svgY - ORIGIN_Y) / SCALE,  // positive = along right wall
    }
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = (e.clientX - rect.left) * (SVG_W / rect.width)
    const svgY = (e.clientY - rect.top) * (SVG_H / rect.height)
    const { rx, rz } = svgToRoom(svgX, svgY)

    const { wall, offset } = getClosestWallAndOffset(rx, rz, walls)
    if (!wall) return

    const cabWidth = placingCabinet?.width ?? (draggingId ? cabinets.find(c => c.id === draggingId)?.width ?? 0.6 : 0.6)
    const isWallCab = placingCabinet 
      ? placingCabinet.type.startsWith('wall') 
      : (draggingId ? cabinets.find(c => c.id === draggingId)?.type.startsWith('wall') || false : false)

    const snapped = getSnappedOffsetWithLength(
      offset, wall.id, wall.length, cabinets, openings, cabWidth,
      draggingId ?? undefined,
      0.20,
      isWallCab
    )

    const isSnapping = Math.abs(snapped - offset) > 0.01
    setSnapActive(isSnapping)
    setHoverWall(wall)
    setHoverOffset(snapped)
    if (onUpdateHoverPos) onUpdateHoverPos(wall.id, snapped)

    if (draggingId) {
      onUpdateCabinetPos(draggingId, wall.id, snapped)
    }
  }, [walls, placingCabinet, draggingId, cabinets, openings, svgToRoom, onUpdateCabinetPos, onUpdateHoverPos])

  const handleMouseLeave = useCallback(() => {
    setHoverWall(null)
    setHoverOffset(0)
    setSnapActive(false)
    if (onUpdateHoverPos) onUpdateHoverPos(null, 0)
  }, [onUpdateHoverPos])

  const handleClick = useCallback(() => {
    if (placingCabinet && hoverWall) {
      onConfirmPlacement(hoverWall.id, hoverOffset)
    }
  }, [placingCabinet, hoverWall, hoverOffset, onConfirmPlacement])

  const handleMouseDown = useCallback((cabId, e) => {
    e.stopPropagation()
    if (!placingCabinet) {
      setDraggingId(cabId)
      if (onDraggingChange) onDraggingChange(cabId)
      onSelectCabinet(cabId)
    }
  }, [placingCabinet, onSelectCabinet, onDraggingChange])

  const handleMouseUp = useCallback(() => {
    setDraggingId(null)
    if (onDraggingChange) onDraggingChange(null)
  }, [onDraggingChange])

  // Build wall SVG paths
  const renderWalls = () => {
    return walls.map(wall => {
      const { sx: sx1, sy: sy1 } = toSvg(wall.x1, wall.z1)
      const { sx: sx2, sy: sy2 } = toSvg(wall.x2, wall.z2)
      // Offset the rect by WALL_THICK/2 in the outward-normal direction
      const outNx = -wall.normalX
      const outNz = -wall.normalZ

      // Build a thick wall polygon
      const perpX = outNx * WALL_THICK
      const perpY = outNz * WALL_THICK

      const corners = [
        [sx1, sy1],
        [sx2, sy2],
        [sx2 + perpX, sy2 + perpY],
        [sx1 + perpX, sy1 + perpY],
      ]
      return (
        <polygon
          key={wall.id}
          points={corners.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="#e5e2db"
          stroke="#2c2b29"
          strokeWidth="1.5"
        />
      )
    })
  }

  // Dimension lines
  const renderDimensions = () => {
    return walls.map(wall => {
      const { sx: sx1, sy: sy1 } = toSvg(wall.x1, wall.z1)
      const { sx: sx2, sy: sy2 } = toSvg(wall.x2, wall.z2)
      const label = `${Math.round(wall.length * 100)} cm`
      const isVert = Math.abs(sx1 - sx2) < 2
      if (isVert) {
        return <DimLine key={wall.id} x1={sx1} y1={Math.min(sy1, sy2)} x2={sx2} y2={Math.max(sy1, sy2)}
          label={label} offset={30} vertical />
      }
      return <DimLine key={wall.id} x1={Math.min(sx1, sx2)} y1={sy1} x2={Math.max(sx1, sx2)} y2={sy2}
        label={label} offset={22} />
    })
  }

  // Cursor style
  const cursor = placingCabinet ? 'crosshair' : draggingId ? 'grabbing' : 'default'

  return (
    <div className="flatplan-container" style={{ overflowY: 'auto' }}>
      
      {/* 2D Plattegrond helemaal bovenaan, met minimale padding */}
      <div className="flatplan-svg-wrapper" style={{ padding: '10px 24px', flex: '0 0 auto', display: 'flex', justifyContent: 'center' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="flatplan-svg"
          style={{ cursor, width: '100%', maxWidth: '520px', height: 'auto' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onMouseUp={handleMouseUp}
        >
          {/* Grid */}
          <defs>
            <pattern id="gridP" width="14" height="14" patternUnits="userSpaceOnUse">
              <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#f1efe9" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridP)" />

          {/* Snap crosshair on hovered wall position */}
          {hoverWall && (placingCabinet || draggingId) && (() => {
            const dsx = (hoverWall.x2 - hoverWall.x1) / hoverWall.length
            const dsz = (hoverWall.z2 - hoverWall.z1) / hoverWall.length
            const cx3 = hoverWall.x1 + dsx * hoverOffset
            const cz3 = hoverWall.z1 + dsz * hoverOffset
            const { sx, sy } = toSvg(cx3, cz3)
            return (
              <g>
                <line x1={sx - 8} y1={sy} x2={sx + 8} y2={sy} stroke={snapActive ? '#826242' : '#a39f96'} strokeWidth="1.5" />
                <line x1={sx} y1={sy - 8} x2={sx} y2={sy + 8} stroke={snapActive ? '#826242' : '#a39f96'} strokeWidth="1.5" />
                <circle cx={sx} cy={sy} r={snapActive ? 5 : 3} fill="none" stroke={snapActive ? '#826242' : '#a39f96'} strokeWidth="1.5" />
              </g>
            )
          })()}

          {/* Walls */}
          {renderWalls()}

          {/* Openings: windows & doors on top of walls */}
          {openings.map(o => {
            const wall = walls.find(w => w.id === o.wall)
            if (!wall) return null
            return o.type === 'door'
              ? <DoorSymbol key={o.id} opening={o} wall={wall} isSelected={selectedOpeningId === o.id} onSelect={onSelectOpening} onDelete={onDeleteOpening} />
              : <WindowSymbol key={o.id} opening={o} wall={wall} isSelected={selectedOpeningId === o.id} onSelect={onSelectOpening} onDelete={onDeleteOpening} />
          })}

          {/* Cabinets */}
          {cabinets.map(cab => {
            const wall = walls.find(w => w.id === cab.wall)
            if (!wall) return null
            return (
              <g key={cab.id} onMouseDown={e => handleMouseDown(cab.id, e)}>
                <CabinetRect
                  cab={cab}
                  wall={wall}
                  isSelected={selectedCabinetId === cab.id}
                  onSelect={onSelectCabinet}
                  onDeleteCabinet={onDeleteCabinet}
                  onAddCabinet={onAddCabinet}
                />
              </g>
            )
          })}

          {/* Ghost preview for placement */}
          {placingCabinet && hoverWall && (
            <GhostCabinet
              cab={placingCabinet}
              wall={hoverWall}
              offset={hoverOffset}
            />
          )}

          {/* Dimension lines */}
          {renderDimensions()}
        </svg>
      </div>

      {/* Actuele Opstelling & Totaalprijs direct onder de plattegrond */}
      <div style={{ borderTop: '1px solid #e5e2db', paddingTop: '12px', paddingLeft: '24px', paddingRight: '24px', paddingBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#2c2b29', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
            Actuele Opstelling ({cabinets.length} elementen)
          </h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#8c887d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Geschatte totaalprijs:
            </span>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#826242' }}>
              € {totalPrice.toLocaleString('nl-BE')}
            </span>
          </div>
        </div>

        {cabinets.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#8c887d', fontStyle: 'italic', margin: 0 }}>
            Geen kasten geplaatst. Selecteer een module in de sidebar en klik op de plattegrond om te starten.
          </p>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', 
            gap: '8px', 
            maxHeight: '200px', 
            overflowY: 'auto', 
            paddingRight: '4px' 
          }}>
            {cabinets.map((cab, i) => (
              <div
                key={cab.id}
                onClick={() => onSelectCabinet(cab.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: selectedCabinetId === cab.id ? '#f7f3ec' : '#fcfbfa',
                  border: '1px solid',
                  borderColor: selectedCabinetId === cab.id ? '#826242' : '#e5e2db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#2c2b29' }}>
                    <span style={{ color: '#826242', marginRight: '6px' }}>#{i + 1}</span>
                    {cab.code}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8c887d' }}>
                    {Math.round(cab.width * 100)}cm · {WALL_LABELS[cab.wall]}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#826242' }}>
                    € {cab.price}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteCabinet(cab.id)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a6a297',
                      fontSize: '18px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: '0 4px',
                      lineHeight: 1,
                    }}
                    title="Verwijderen"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
