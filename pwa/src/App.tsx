import { useState, useMemo } from 'react';
import {
  Monitor,
  Settings,
  Plus,
  Trash2,
  Box,
  FileCode,
  ExternalLink,
  Folder
} from 'lucide-react';
import { Dock, DockItem } from './lib/dock-engine';
import { generatePackageZIP, downloadFile } from './lib/package-generator';
import './App.css';

import { Upload } from 'lucide-react';

import {
  getAllSuggestions,
  saveCustomApps,
  getCustomApps,
  parseDirectoryListing
} from './lib/app-suggestions';

function App() {
  const [displayName, setDisplayName] = useState('My Custom Dock');
  const [organization, setOrganization] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'System' | 'User'>('System');
  const [tileSize, setTileSize] = useState(68);
  const [position, setPosition] = useState<'left' | 'bottom' | 'right'>('bottom');
  const [items, setItems] = useState<DockItem[]>([]);
  const [activeTab, setActiveTab] = useState<'items' | 'settings'>('items');
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importBasePath, setImportBasePath] = useState('/Applications');

  const suggestions = useMemo(() => getAllSuggestions(), []);

  const dock = useMemo(() => {
    const d = new Dock({
      payloadDisplayName: displayName,
      payloadOrganization: organization,
      payloadDescription: description,
      payloadScope: scope,
      dockTileSize: tileSize,
      dockPosition: position,
    });
    items.forEach(item => d.addItem(item));
    return d;
  }, [displayName, organization, description, scope, tileSize, position, items]);

  const addItem = () => {
    const newItem = new DockItem({
      cfurlString: '/Applications/App.app',
      label: 'New Item',
    });
    setItems([...items, newItem]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, options: Partial<DockItem>) => {
    const newItems = [...items];
    const item = newItems[index];
    Object.assign(item, options);
    setItems(newItems);
  };

  const handleDownloadProfile = () => {
    const xml = dock.generateProfileXML();
    const blob = new Blob([xml], { type: 'application/x-apple-aspen-config' });
    downloadFile(blob, `${dock.payloadIdentifier}.mobileconfig`);
  };

  const handleDownloadPackage = async () => {
    const blob = await generatePackageZIP(dock);
    downloadFile(blob, `${dock.payloadIdentifier}-template.zip`);
  };

  const handleImport = () => {
    const parsed = parseDirectoryListing(importText, importBasePath);
    if (parsed.length > 0) {
      const currentCustom = getCustomApps();
      const newCustom = [...currentCustom, ...parsed];
      // De-duplicate by path
      const unique = Array.from(new Map(newCustom.map(app => [app.path, app])).values());
      saveCustomApps(unique);
      setImportText('');
      setShowImport(false);
      alert(`Imported ${parsed.length} apps to suggestions!`);
      // Force refresh of suggestions would happen on next render if we used state, 
      // but useMemo's empty dependency means we might need a refresh trigger.
      window.location.reload(); // Simple way to refresh suggestions
    }
  };

  const handleLoadConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const xml = event.target?.result as string;
      try {
        const loadedDock = Dock.fromXML(xml);

        // Update states
        setDisplayName(loadedDock.payloadDisplayName);
        setOrganization(loadedDock.payloadOrganization || '');
        setDescription(loadedDock.payloadDescription || '');
        setScope(loadedDock.payloadScope);
        setTileSize(loadedDock.dockTileSize);
        setPosition(loadedDock.dockPosition);

        // Collect all items from all categories
        const allItems = [
          ...loadedDock.staticApps,
          ...loadedDock.persistentApps,
          ...loadedDock.staticOthers,
          ...loadedDock.persistentOthers
        ];
        setItems(allItems);

        alert(`Loaded configuration: ${loadedDock.payloadDisplayName}`);
      } catch (err) {
        console.error('Failed to parse config:', err);
        alert('Failed to parse the configuration file. Please ensure it is a valid .mobileconfig or .plist file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <Monitor size={24} color="var(--accent-primary)" />
          <h1>Dock Builder</h1>
        </div>
        <div className="actions">
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={18} />
            <span>Config from File</span>
            <input
              type="file"
              accept=".mobileconfig,.plist"
              style={{ display: 'none' }}
              onChange={handleLoadConfig}
            />
          </label>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            <Plus size={18} />
            <span>Import Apps</span>
          </button>
          <button className="btn btn-secondary" onClick={handleDownloadProfile}>
            <FileCode size={18} />
            <span>Profile</span>
          </button>
          <button className="btn btn-primary" onClick={handleDownloadPackage}>
            <Box size={18} />
            <span>Package</span>
          </button>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <button
            className={`nav-item ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            <Plus size={20} />
            <span>Dock Items</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </aside>

        <main className="editor">
          {activeTab === 'items' ? (
            <div className="tab-pane animate-fade-in">
              <div className="section-header">
                <h2>Applications & Folders</h2>
                <button className="add-btn" onClick={addItem}>
                  <Plus size={16} /> Add Item
                </button>
              </div>
              <div className="items-list">
                {items.length === 0 && (
                  <div className="empty-state">
                    <p>No items added yet. Click "Add Item" to begin.</p>
                  </div>
                )}
                {items.map((item, index) => (
                  <div key={index} className="item-card">
                    <div className="item-icon">
                      {item.tileType === 'directory-tile' ? <Folder /> : <ExternalLink />}
                    </div>
                    <div className="item-details">
                      <input
                        type="text"
                        value={item.label || ''}
                        onChange={(e) => updateItem(index, { label: e.target.value })}
                        placeholder="Label (e.g. Safari)"
                      />
                      <input
                        type="text"
                        value={item.cfurlString}
                        onChange={(e) => updateItem(index, { cfurlString: e.target.value })}
                        onFocus={() => setFocusedIndex(index)}
                        onBlur={() => setTimeout(() => setFocusedIndex(null), 200)}
                        placeholder="Path or URL (e.g. /Applications/Safari.app)"
                      />
                      {focusedIndex === index && item.cfurlString.length > 0 && (
                        <div className="autocomplete-wrapper">
                          {suggestions.filter(app =>
                            app.label.toLowerCase().includes(item.cfurlString.toLowerCase()) ||
                            app.path.toLowerCase().includes(item.cfurlString.toLowerCase())
                          ).map((app, i) => (
                            <div
                              key={i}
                              className="suggestion-item"
                              onMouseDown={() => {
                                updateItem(index, { label: app.label, cfurlString: app.path });
                                setFocusedIndex(null);
                              }}
                            >
                              <span>{app.label}</span>
                              <span className="suggestion-path">{app.path}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="item-settings">
                      <label>
                        <input
                          type="checkbox"
                          checked={item.removable}
                          onChange={(e) => updateItem(index, { removable: e.target.checked })}
                        />
                        <span>Removable</span>
                      </label>
                      <button className="remove-btn" onClick={() => removeItem(index)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="tab-pane animate-fade-in">
              <div className="section-header">
                <h2>General Preferences</h2>
              </div>
              <div className="settings-form">
                <div className="form-group">
                  <label>Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Organization</label>
                  <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Scope</label>
                    <select value={scope} onChange={(e) => setScope(e.target.value as any)}>
                      <option value="System">System</option>
                      <option value="User">User</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Position</label>
                    <select value={position} onChange={(e) => setPosition(e.target.value as any)}>
                      <option value="bottom">Bottom</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Tile Size ({tileSize}px)</label>
                  <input
                    type="range"
                    min="16"
                    max="128"
                    value={tileSize}
                    onChange={(e) => setTileSize(parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showImport && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Import Local Applications</h3>
            <p>Paste the output of <code>ls /Applications</code> or <code>dir /Applications</code> below.</p>
            <div className="form-group">
              <label>Base Path</label>
              <input
                type="text"
                value={importBasePath}
                onChange={(e) => setImportBasePath(e.target.value)}
                placeholder="/Applications"
              />
            </div>
            <textarea
              placeholder="Safari.app
Terminal.app
..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              style={{ minHeight: '300px' }}
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleImport}>Import</button>
            </div>
          </div>
        </div>
      )}

      <footer className="dock-preview-container">
        <div className={`dock-preview dock-${position}`}>
          {items.map((item, index) => (
            <div key={index} className="preview-item" style={{ width: tileSize / 1.5, height: tileSize / 1.5 }}>
              <div className="preview-icon">
                {item.tileType === 'directory-tile' ? <Folder size={tileSize / 3} /> : <Box size={tileSize / 3} />}
              </div>
              <div className="preview-label">{item.label || 'App'}</div>
            </div>
          ))}
          {items.length === 0 && <div className="preview-placeholder">Dock Preview</div>}
        </div>
      </footer>
    </div>
  );
}

export default App;
