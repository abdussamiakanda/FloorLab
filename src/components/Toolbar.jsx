const TOOLS = [
  { id: 'select', label: 'Select' },
  { id: 'wall', label: 'Wall' },
  { id: 'door', label: 'Door' },
  { id: 'window', label: 'Window' },
  { id: 'room', label: 'Room' },
  { id: 'delete', label: 'Delete' },
]

function Toolbar({
  selectedTool,
  onToolChange,
  onUndo,
  onRedo,
  onSave,
  onToggleGrid,
  onToggleSnap,
  gridEnabled,
  snapEnabled,
  onExportJson,
  onExportPng,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={selectedTool === tool.id ? 'active' : ''}
            onClick={() => onToolChange(tool.id)}
          >
            {tool.label}
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        <button type="button" onClick={onUndo}>
          Undo
        </button>
        <button type="button" onClick={onRedo}>
          Redo
        </button>
        <button type="button" onClick={onSave}>
          Save
        </button>
      </div>

      <div className="toolbar-group">
        <button type="button" className={gridEnabled ? 'active' : ''} onClick={onToggleGrid}>
          Grid
        </button>
        <button type="button" className={snapEnabled ? 'active' : ''} onClick={onToggleSnap}>
          Snap
        </button>
      </div>

      <div className="toolbar-group">
        <button type="button" onClick={onExportJson}>
          Export JSON
        </button>
        <button type="button" onClick={onExportPng}>
          Export PNG
        </button>
      </div>

      <div className="toolbar-info">
        <span>Tip: Use ruler to measure objects</span>
      </div>
    </div>
  )
}

export default Toolbar
