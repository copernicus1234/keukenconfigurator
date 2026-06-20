const BESCHIKBARE_MODULES = [
  { code: 'G88', type: 'tall', width: 0.6, height: 2.0, depth: 0.6, desc: 'Hoge kast voor koelkast/oven (60cm)' },
  { code: 'UA60', type: 'base_drawer', width: 0.6, height: 0.8, depth: 0.6, desc: 'Ladekast 1 lade, 2 uittrekelementen (60cm)' },
  { code: 'US80', type: 'base_door', width: 0.8, height: 0.8, depth: 0.6, desc: 'Onderkast 2 deuren, 1 legplank (80cm)' },
  { code: 'SPUD80', type: 'base_sink', width: 0.8, height: 0.8, depth: 0.6, desc: 'Spoelkast voor spoelbak (80cm)' },
  { code: 'SPUD60', type: 'base_sink', width: 0.6, height: 0.8, depth: 0.6, desc: 'Spoelkast voor spoelbak (60cm)' },
  { code: 'GSB60-I', type: 'base_dishwasher', width: 0.6, height: 0.8, depth: 0.6, desc: 'Geïntegreerde vaatwasser front (60cm)' },
  { code: 'W60-3', type: 'wall', width: 0.6, height: 0.7, depth: 0.35, desc: 'Bovenkast met draaideur (60cm)' },
  { code: 'WDAF60-3', type: 'wall_extractor', width: 0.6, height: 0.7, depth: 0.35, desc: 'Bovenkast voor afzuigkap (60cm)' }
]

const MATERIALEN = [
  { id: 'natural_oak', name: 'Natuurlijk Eiken', color: '#bfa37a', roughness: 0.5, previewColor: '#cfa976' },
  { id: 'smoked_oak', name: 'Gerookt Eiken', color: '#4e3d30', roughness: 0.6, previewColor: '#534337' },
  { id: 'washed_oak', name: 'Wit Geolied Eiken', color: '#dfd5c6', roughness: 0.4, previewColor: '#e5dbcc' }
]

export default function Sidebar({
  cabinets,
  onAddCabinet,
  onDeleteCabinet,
  selectedCabinetId,
  onSelectCabinet,
  selectedMaterial,
  onSelectMaterial,
  onReset
}) {
  return (
    <aside className="sidebar">
      {/* Logo Sectie */}
      <div className="logo-container">
        <img 
          src="/logo totaal met contourbeer-200 5pts.svg" 
          alt="Kodiak Interieurs" 
          onError={(e) => {
            // Fallback als het logo niet getoond kan worden
            e.target.style.display = 'none'
            const parent = e.target.parentNode
            const textNode = document.createElement('div')
            textNode.style.fontWeight = 'bold'
            textNode.style.fontSize = '20px'
            textNode.style.letterSpacing = '1px'
            textNode.style.color = '#2c2b29'
            textNode.innerText = 'KODIAK INTERIEURS'
            parent.appendChild(textNode)
          }}
        />
      </div>

      <div className="sidebar-content">
        {/* Houtafwerking */}
        <div>
          <h2 className="section-title">Houtafwerking (Eiken)</h2>
          <div className="material-grid">
            {MATERIALEN.map((mat) => (
              <div 
                key={mat.id}
                className={`material-card ${selectedMaterial.id === mat.id ? 'active' : ''}`}
                onClick={() => onSelectMaterial(mat)}
              >
                <div 
                  className="material-preview" 
                  style={{ backgroundColor: mat.previewColor }} 
                />
                <span className="material-name">{mat.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Modules toevoegen */}
        <div>
          <h2 className="section-title">Modules Toevoegen</h2>
          <div className="module-list">
            {BESCHIKBARE_MODULES.map((mod) => (
              <div 
                key={mod.code}
                className="module-item"
                onClick={() => onAddCabinet(mod)}
              >
                <div className="module-info">
                  <span className="module-code">{mod.code}</span>
                  <span className="module-desc">{mod.desc}</span>
                </div>
                <button className="module-add-btn">+</button>
              </div>
            ))}
          </div>
        </div>

        {/* Geplaatste modules */}
        <div>
          <h2 className="section-title">Uw Opstelling ({cabinets.length})</h2>
          {cabinets.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#8c887d', fontStyle: 'italic' }}>
              Nog geen modules geplaatst.
            </p>
          ) : (
            <div className="placed-list">
              {cabinets.map((cab, index) => (
                <div 
                  key={cab.id} 
                  className={`placed-item ${selectedCabinetId === cab.id ? 'selected' : ''}`}
                  onClick={() => onSelectCabinet(cab.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div>
                    <span style={{ color: '#826242', marginRight: '6px' }}>#{index + 1}</span>
                    <span>{cab.code}</span>
                    <span style={{ color: '#8c887d', fontSize: '10px', marginLeft: '6px' }}>
                      ({Math.round(cab.width * 100)}cm)
                    </span>
                  </div>
                  <button 
                    className="placed-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteCabinet(cab.id)
                    }}
                    title="Verwijder module"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Knoppen */}
      <div className="footer-buttons">
        <button className="btn-secondary" onClick={onReset}>
          Ontwerp Wissen
        </button>
      </div>
    </aside>
  )
}
