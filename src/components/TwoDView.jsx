const SCALE = 80 // pixels per meter (1m = 80px)
const CORNER_X = 410 // corner point X
const CORNER_Y = 70  // corner point Y

export default function TwoDView({
  cabinets,
  selectedCabinetId,
  onSelectCabinet,
  wallDimensions = { back: 4.0, right: 4.74 } // in meters
}) {
  // Conversie van meters naar pixels
  const backWallLengthPx = wallDimensions.back * SCALE
  const rightWallLengthPx = wallDimensions.right * SCALE

  // Hulpmiddel om SVG coördinaten te berekenen op basis van wand-relatieve posities
  const renderCabinets = () => {
    return cabinets.map((cab) => {
      const isSelected = cab.id === selectedCabinetId
      const widthPx = cab.width * SCALE
      const depthPx = cab.depth * SCALE

      // Bepaal of de kast tegen de rechterwand (vertical) of de achterwand (horizontal) staat
      if (cab.wall === 'right') {
        // Positie langs de rechterwand (Z-as in 3D -> Y-as in SVG)
        // cab.position[2] is het middelpunt op de Z-as in 3D
        const centerY = CORNER_Y + cab.position[2] * SCALE
        const rectX = CORNER_X - depthPx
        const rectY = centerY - widthPx / 2

        if (cab.type.startsWith('wall')) {
          // Bovenkasten: gestreepte rechthoek, hangt "boven" de onderkasten (dus smaller en dichter bij de muur)
          const wallDepthPx = 0.35 * SCALE // Bovenkast is minder diep
          return (
            <g 
              key={cab.id} 
              onClick={() => onSelectCabinet(cab.id)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={CORNER_X - wallDepthPx}
                y={rectY}
                width={wallDepthPx}
                height={widthPx}
                fill="none"
                stroke={isSelected ? '#826242' : '#8c887d'}
                strokeWidth={isSelected ? 2 : 1.5}
                strokeDasharray="4,4"
              />
              {/* Text label voor bovenkast */}
              <text
                x={CORNER_X - wallDepthPx / 2}
                y={centerY}
                fontSize="8px"
                fontWeight="bold"
                fill={isSelected ? '#826242' : '#8c887d'}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(-90, ${CORNER_X - wallDepthPx / 2}, ${centerY})`}
              >
                {cab.code}
              </text>
            </g>
          )
        } else {
          // Onderkasten & Hoge kasten: massief gevulde rechthoek
          const isTall = cab.type === 'tall'
          return (
            <g 
              key={cab.id} 
              onClick={() => onSelectCabinet(cab.id)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={rectX}
                y={rectY}
                width={depthPx}
                height={widthPx}
                fill={isSelected ? '#f5ede0' : (isTall ? '#eae6dc' : '#f5f4f0')}
                stroke={isSelected ? '#826242' : '#2c2b29'}
                strokeWidth={isSelected ? 2.5 : 1.5}
                rx={2}
              />
              {/* Kastcode (bijv UA60) */}
              <text
                x={rectX + depthPx / 2}
                y={centerY - 4}
                fontSize="9px"
                fontWeight="bold"
                fill={isSelected ? '#826242' : '#2c2b29'}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(-90, ${rectX + depthPx / 2}, ${centerY - 4})`}
              >
                {cab.code}
              </text>
              {/* Kastbreedte in cm */}
              <text
                x={rectX + depthPx / 2}
                y={centerY + 8}
                fontSize="8px"
                fill="#8c887d"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(-90, ${rectX + depthPx / 2}, ${centerY + 8})`}
              >
                {Math.round(cab.width * 100)}
              </text>
            </g>
          )
        }
      } else {
        // Positie langs de achterwand (X-as in 3D -> X-as in SVG, loopt naar links dus negatieve X)
        const centerX = CORNER_X + cab.position[0] * SCALE
        const rectX = centerX - widthPx / 2
        const rectY = CORNER_Y

        if (cab.type.startsWith('wall')) {
          const wallDepthPx = 0.35 * SCALE
          return (
            <g 
              key={cab.id} 
              onClick={() => onSelectCabinet(cab.id)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={rectX}
                y={CORNER_Y}
                width={widthPx}
                height={wallDepthPx}
                fill="none"
                stroke={isSelected ? '#826242' : '#8c887d'}
                strokeWidth={isSelected ? 2 : 1.5}
                strokeDasharray="4,4"
              />
              <text
                x={centerX}
                y={CORNER_Y + wallDepthPx / 2}
                fontSize="8px"
                fontWeight="bold"
                fill={isSelected ? '#826242' : '#8c887d'}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {cab.code}
              </text>
            </g>
          )
        } else {
          const isTall = cab.type === 'tall'
          return (
            <g 
              key={cab.id} 
              onClick={() => onSelectCabinet(cab.id)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={rectX}
                y={rectY}
                width={widthPx}
                height={depthPx}
                fill={isSelected ? '#f5ede0' : (isTall ? '#eae6dc' : '#f5f4f0')}
                stroke={isSelected ? '#826242' : '#2c2b29'}
                strokeWidth={isSelected ? 2.5 : 1.5}
                rx={2}
              />
              <text
                x={centerX}
                y={rectY + depthPx / 2 - 6}
                fontSize="9px"
                fontWeight="bold"
                fill={isSelected ? '#826242' : '#2c2b29'}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {cab.code}
              </text>
              <text
                x={centerX}
                y={rectY + depthPx / 2 + 6}
                fontSize="8px"
                fill="#8c887d"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {Math.round(cab.width * 100)}
              </text>
            </g>
          )
        }
      }
    });
  }

  return (
    <div className="flatplan-container">
      <div className="flatplan-header">
        Plattegrond (2D Weergave)
      </div>
      <div className="flatplan-svg-wrapper">
        <svg 
          viewBox="0 0 500 500" 
          className="flatplan-svg"
        >
          {/* Grid achtergrond voor technisch gevoel */}
          <defs>
            <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1efe9" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridPattern)" />

          {/* L-Wanden (Muren) */}
          {/* Achterwand */}
          <rect
            x={CORNER_X - backWallLengthPx}
            y={CORNER_Y - 12}
            width={backWallLengthPx + 12}
            height={12}
            fill="#e5e2db"
            stroke="#2c2b29"
            strokeWidth="1.5"
          />
          {/* Rechterwand */}
          <rect
            x={CORNER_X}
            y={CORNER_Y - 12}
            width={12}
            height={rightWallLengthPx + 12}
            fill="#e5e2db"
            stroke="#2c2b29"
            strokeWidth="1.5"
          />

          {/* Kasten renderen */}
          {renderCabinets()}

          {/* Maatvoeringslijnen */}
          {/* Achterwand Maatvoering (400 cm) */}
          <g>
            {/* Lijn */}
            <line 
              x1={CORNER_X - backWallLengthPx} 
              y1={CORNER_Y - 28} 
              x2={CORNER_X} 
              y2={CORNER_Y - 28} 
              stroke="#8c887d" 
              strokeWidth="1" 
            />
            {/* Ticks */}
            <line x1={CORNER_X - backWallLengthPx} y1={CORNER_Y - 33} x2={CORNER_X - backWallLengthPx} y2={CORNER_Y - 23} stroke="#8c887d" strokeWidth="1.5" />
            <line x1={CORNER_X} y1={CORNER_Y - 33} x2={CORNER_X} y2={CORNER_Y - 23} stroke="#8c887d" strokeWidth="1.5" />
            {/* Tekst */}
            <rect x={CORNER_X - backWallLengthPx / 2 - 25} y={CORNER_Y - 38} width="50" height="18" fill="#fdfdfc" rx="4" />
            <text 
              x={CORNER_X - backWallLengthPx / 2} 
              y={CORNER_Y - 28} 
              fontSize="11px" 
              fontWeight="600"
              fill="#2c2b29" 
              textAnchor="middle" 
              dominantBaseline="middle"
            >
              {Math.round(wallDimensions.back * 100)} cm
            </text>
          </g>

          {/* Rechterwand Maatvoering (474 cm) */}
          <g>
            {/* Lijn */}
            <line 
              x1={CORNER_X + 28} 
              y1={CORNER_Y} 
              x2={CORNER_X + 28} 
              y2={CORNER_Y + rightWallLengthPx} 
              stroke="#8c887d" 
              strokeWidth="1" 
            />
            {/* Ticks */}
            <line x1={CORNER_X + 23} y1={CORNER_Y} x2={CORNER_X + 33} y2={CORNER_Y} stroke="#8c887d" strokeWidth="1.5" />
            <line x1={CORNER_X + 23} y1={CORNER_Y + rightWallLengthPx} x2={CORNER_X + 33} y2={CORNER_Y + rightWallLengthPx} stroke="#8c887d" strokeWidth="1.5" />
            {/* Tekst */}
            <rect x={CORNER_X + 18} y={CORNER_Y + rightWallLengthPx / 2 - 25} width="20" height="50" fill="#fdfdfc" rx="4" />
            <text 
              x={CORNER_X + 28} 
              y={CORNER_Y + rightWallLengthPx / 2} 
              fontSize="11px" 
              fontWeight="600"
              fill="#2c2b29" 
              textAnchor="middle" 
              dominantBaseline="middle"
              transform={`rotate(90, ${CORNER_X + 28}, ${CORNER_Y + rightWallLengthPx / 2})`}
            >
              {Math.round(wallDimensions.right * 100)} cm
            </text>
          </g>
        </svg>
      </div>
    </div>
  )
}
