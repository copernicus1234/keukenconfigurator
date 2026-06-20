import { useState } from 'react'

const BESCHIKBARE_MODULES = [
  { code: 'G88',     type: 'tall',             width: 0.6, height: 2.0, depth: 0.60, desc: 'Hoge kast koelkast/oven (60cm)' },
  { code: 'UA60',    type: 'base_drawer',       width: 0.6, height: 0.8, depth: 0.60, desc: 'Ladekast 3 lades (60cm)' },
  { code: 'US80',    type: 'base_door',         width: 0.8, height: 0.8, depth: 0.60, desc: 'Onderkast 2 deuren (80cm)' },
  { code: 'SPUD80',  type: 'base_sink',         width: 0.8, height: 0.8, depth: 0.60, desc: 'Spoelkast (80cm)' },
  { code: 'SPUD60',  type: 'base_sink',         width: 0.6, height: 0.8, depth: 0.60, desc: 'Spoelkast (60cm)' },
  { code: 'GSB60-I', type: 'base_dishwasher',   width: 0.6, height: 0.8, depth: 0.60, desc: 'Vaatwasser front (60cm)' },
  { code: 'W60-3',   type: 'wall',              width: 0.6, height: 0.7, depth: 0.35, desc: 'Bovenkast draaideur (60cm)' },
  { code: 'WDAF60',  type: 'wall_extractor',    width: 0.6, height: 0.7, depth: 0.35, desc: 'Bovenkast afzuigkap (60cm)' },
]

const MATERIALEN = [
  { id: 'natural_oak', name: 'Natuurlijk Eiken', color: '#bfa37a', roughness: 0.5, previewColor: '#cfa976' },
  { id: 'smoked_oak',  name: 'Gerookt Eiken',    color: '#4e3d30', roughness: 0.6, previewColor: '#534337' },
  { id: 'washed_oak',  name: 'Wit Geolied',      color: '#dfd5c6', roughness: 0.4, previewColor: '#e5dbcc' },
]

const ROOM_SHAPES = [
  { id: 'straight', label: 'Recht',  icon: '▬' },
  { id: 'L-shape',  label: 'L-vorm', icon: '⌐' },
  { id: 'U-shape',  label: 'U-vorm', icon: '⊓' },
]

const WALL_LABELS = { back: 'Achterwand', right: 'Rechterwand', left: 'Linkerwand' }

export default function Sidebar({
  cabinets,
  openings,
  onAddCabinet,
  onDeleteCabinet,
  selectedCabinetId,
  onSelectCabinet,
  selectedMaterial,
  onSelectMaterial,
  onReset,
  roomShape,
  onSelectRoomShape,
  wallLengths,
  onUpdateWallLengths,
  onAddOpening,
  onDeleteOpening,
  onUpdateOpening,
  placingCabinet,
  onCancelPlacement,
}) {
  const [activeTab, setActiveTab] = useState('room') // 'room' | 'cabinets'

  const visibleWalls = roomShape === 'straight'
    ? ['back']
    : roomShape === 'L-shape'
    ? ['back', 'right']
    : ['back', 'right', 'left']

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="logo-container">
        <img
          src="/logo totaal met contourbeer-200 5pts.svg"
          alt="Kodiak Interieurs"
          onError={(e) => {
            e.target.style.display = 'none'
            const div = document.createElement('div')
            div.style.cssText = 'font-weight:700;font-size:18px;letter-spacing:1px;color:#2c2b29'
            div.innerText = 'KODIAK INTERIEURS'
            e.target.parentNode.appendChild(div)
          }}
        />
      </div>

      {/* Subtitle / copyright */}
      <div style={{
        textAlign: 'center',
        padding: '8px 20px 14px',
        borderBottom: '1px solid #e5e2db',
      }}>
        <div style={{
          fontSize: '15px',
          fontWeight: '700',
          letterSpacing: '1px',
          color: '#3b2512',
          lineHeight: 1.3,
        }}>
          kodiak <span style={{ color: '#826242' }}>KEUKENCONFIGURATOR</span>
        </div>
        <div style={{
          fontSize: '10px',
          fontWeight: '400',
          letterSpacing: '0.4px',
          color: '#a6a297',
          marginTop: '4px',
          lineHeight: 1.4,
        }}>
          ontwikkeld door 2026 &copy; Kodiak HPMB
        </div>
      </div>

      {/* Placement mode banner */}
      {placingCabinet && (
        <div style={{
          background: '#826242', color: 'white', padding: '10px 16px',
          fontSize: '12px', fontWeight: '600', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>📐 Klik op de plattegrond om {placingCabinet.code} te plaatsen</span>
          <button
            onClick={onCancelPlacement}
            style={{ background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e2db' }}>
        {[['room', '🏠 Ruimte'], ['cabinets', '🪵 Kasten']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              flex: 1, padding: '11px 6px', border: 'none', background: 'none',
              fontSize: '12px', fontWeight: activeTab === id ? '700' : '500',
              color: activeTab === id ? '#826242' : '#8c887d',
              borderBottom: activeTab === id ? '2px solid #826242' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >{label}</button>
        ))}
      </div>

      <div className="sidebar-content">

        {/* === TAB: RUIMTE === */}
        {activeTab === 'room' && (
          <>
            {/* Kamervorm kiezen */}
            <div>
              <h2 className="section-title">Kamervorm</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                {ROOM_SHAPES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onSelectRoomShape(s.id)}
                    style={{
                      padding: '10px 4px', border: '2px solid',
                      borderColor: roomShape === s.id ? '#826242' : '#e5e2db',
                      borderRadius: '6px', background: roomShape === s.id ? '#f7f3ec' : '#fff',
                      cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                      color: roomShape === s.id ? '#826242' : '#6c685d',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Wandafmetingen */}
            <div>
              <h2 className="section-title">Wandafmetingen</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {visibleWalls.map(wallId => (
                  <div key={wallId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#6c685d', flex: 1 }}>{WALL_LABELS[wallId]}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min="100"
                        max="800"
                        step="10"
                        value={Math.round(wallLengths[wallId] * 100)}
                        onChange={e => onUpdateWallLengths(prev => ({
                          ...prev,
                          [wallId]: Math.max(1.0, Math.min(8.0, parseInt(e.target.value) / 100))
                        }))}
                        style={{
                          width: '70px', padding: '6px 8px', border: '1px solid #e5e2db',
                          borderRadius: '6px', fontSize: '13px', fontWeight: '600',
                          textAlign: 'right', color: '#2c2b29', background: '#fcfbfa'
                        }}
                      />
                      <span style={{ fontSize: '11px', color: '#8c887d' }}>cm</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ramen & Deuren */}
            <div>
              <h2 className="section-title">Ramen & Deuren</h2>

              {/* Toevoegen knoppen per wand */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {visibleWalls.map(wallId => (
                  <div key={wallId} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#8c887d', width: '80px' }}>{WALL_LABELS[wallId]}</span>
                    <button
                      onClick={() => onAddOpening('window', wallId)}
                      style={{
                        flex: 1, padding: '6px', border: '1px solid #e5e2db', borderRadius: '5px',
                        background: '#fcfbfa', fontSize: '11px', cursor: 'pointer', fontWeight: '500'
                      }}
                    >+ Raam</button>
                    <button
                      onClick={() => onAddOpening('door', wallId)}
                      style={{
                        flex: 1, padding: '6px', border: '1px solid #e5e2db', borderRadius: '5px',
                        background: '#fcfbfa', fontSize: '11px', cursor: 'pointer', fontWeight: '500'
                      }}
                    >+ Deur</button>
                  </div>
                ))}
              </div>

              {/* Lijst geplaatste openings */}
              {openings.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {openings.map(o => (
                    <div key={o.id} style={{
                      background: '#f7f6f2', borderRadius: '6px', padding: '8px 12px',
                      display: 'flex', flexDirection: 'column', gap: '6px',
                      border: '1px solid #e5e2db'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700' }}>
                          {o.type === 'door' ? '🚪' : '🪟'} {o.type === 'door' ? 'Deur' : 'Raam'} — {WALL_LABELS[o.wall]}
                        </span>
                        <button
                          onClick={() => onDeleteOpening(o.id)}
                          style={{ background: 'none', border: 'none', color: '#a6a297', fontSize: '16px', cursor: 'pointer' }}
                        >×</button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <label style={{ fontSize: '10px', color: '#8c887d', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          Offset (cm)
                          <input
                            type="number" min="10" max="800" step="5"
                            value={Math.round(o.offset * 100)}
                            onChange={e => onUpdateOpening(o.id, 'offset', parseInt(e.target.value) / 100)}
                            style={{ width: '60px', padding: '4px', border: '1px solid #e5e2db', borderRadius: '4px', fontSize: '12px' }}
                          />
                        </label>
                        <label style={{ fontSize: '10px', color: '#8c887d', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          Breedte (cm)
                          <input
                            type="number" min="40" max="300" step="5"
                            value={Math.round(o.width * 100)}
                            onChange={e => onUpdateOpening(o.id, 'width', parseInt(e.target.value) / 100)}
                            style={{ width: '60px', padding: '4px', border: '1px solid #e5e2db', borderRadius: '4px', fontSize: '12px' }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* === TAB: KASTEN === */}
        {activeTab === 'cabinets' && (
          <>
            {/* Houtafwerking */}
            <div>
              <h2 className="section-title">Houtafwerking</h2>
              <div className="material-grid">
                {MATERIALEN.map(mat => (
                  <div
                    key={mat.id}
                    className={`material-card ${selectedMaterial.id === mat.id ? 'active' : ''}`}
                    onClick={() => onSelectMaterial(mat)}
                  >
                    <div className="material-preview" style={{ backgroundColor: mat.previewColor }} />
                    <span className="material-name">{mat.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modules toevoegen */}
            <div>
              <h2 className="section-title">Modules</h2>
              <div className="module-list">
                {BESCHIKBARE_MODULES.map(mod => (
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

            {/* Opstelling */}
            <div>
              <h2 className="section-title">Opstelling ({cabinets.length})</h2>
              {cabinets.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#8c887d', fontStyle: 'italic' }}>
                  Selecteer een module hierboven en klik op de plattegrond.
                </p>
              ) : (
                <div className="placed-list">
                  {cabinets.map((cab, i) => (
                    <div
                      key={cab.id}
                      className={`placed-item ${selectedCabinetId === cab.id ? 'selected' : ''}`}
                      onClick={() => onSelectCabinet(cab.id)}
                    >
                      <div>
                        <span style={{ color: '#826242', marginRight: '6px' }}>#{i + 1}</span>
                        <span>{cab.code}</span>
                        <span style={{ color: '#8c887d', fontSize: '10px', marginLeft: '6px' }}>
                          ({Math.round(cab.width * 100)}cm · {WALL_LABELS[cab.wall]})
                        </span>
                      </div>
                      <button
                        className="placed-delete-btn"
                        onClick={e => { e.stopPropagation(); onDeleteCabinet(cab.id) }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="footer-buttons">
        <button className="btn-secondary" onClick={onReset}>Ontwerp Wissen</button>
      </div>
    </aside>
  )
}
