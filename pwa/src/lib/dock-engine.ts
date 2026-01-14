import plist from 'plist';

export type TileType = 'directory-tile' | 'file-tile' | 'url-tile';

export interface DockItemOptions {
  cfurlString: string;
  arrangement?: number;
  showAs?: number;
  displayAs?: number;
  label?: string;
  removable?: boolean;
}

export class DockItem {
  cfurlString: string;
  arrangement?: number;
  showAs?: number;
  displayAs?: number;
  label?: string;
  removable: boolean = false;

  constructor(options: DockItemOptions) {
    this.cfurlString = options.cfurlString;
    this.arrangement = options.arrangement;
    this.showAs = options.showAs;
    this.displayAs = options.displayAs;
    this.label = options.label;
    this.removable = options.removable ?? false;
  }

  get tileType(): TileType {
    if (this.cfurlString.includes('://')) {
      return 'url-tile';
    }
    // Simple extension check
    const parts = this.cfurlString.split('.');
    if (parts.length > 1 && !this.cfurlString.endsWith('/')) {
      return 'file-tile';
    }
    return 'directory-tile';
  }

  get cfurlStringType(): number | null {
    if (this.cfurlString.startsWith('~')) {
      return null;
    }
    if (this.cfurlString.includes('://')) {
      return 15;
    }
    return 0;
  }

  generateDockItemXML(): any {
    const tileData: any = {};
    const fileData: any = {};

    if (this.cfurlString.startsWith('~')) {
      tileData['home directory relative'] = this.cfurlString;
    }

    if (this.arrangement !== undefined) tileData['arrangement'] = this.arrangement;
    else if (this.tileType === 'directory-tile') tileData['arrangement'] = 1;

    if (this.displayAs !== undefined) tileData['displayas'] = this.displayAs;
    else if (this.tileType === 'directory-tile') tileData['displayas'] = 2;

    if (this.showAs !== undefined) tileData['showas'] = this.showAs;
    else if (this.tileType === 'directory-tile') tileData['showas'] = 4;

    if (this.label) {
      tileData['label'] = this.label;
    } else if (this.tileType === 'url-tile') {
      const parts = this.cfurlString.split('/');
      tileData['label'] = parts[parts.length - 1] || 'Link';
    }

    if (!this.cfurlString.startsWith('~')) {
      fileData['_CFURLString'] = this.cfurlString;
      fileData['_CFURLStringType'] = this.cfurlStringType;

      if (this.tileType === 'url-tile') {
        tileData['url'] = fileData;
      } else {
        tileData['file-data'] = fileData;
      }
    }

    return {
      'tile-type': this.tileType,
      'tile-data': tileData,
    };
  }

  static fromXML(data: any): DockItem {
    const tileData = data['tile-data'] || {};
    const fileData = tileData['file-data'] || tileData['url'] || {};
    const cfurlString = fileData['_CFURLString'] || tileData['home directory relative'] || '';

    return new DockItem({
      cfurlString,
      arrangement: tileData['arrangement'],
      showAs: tileData['showas'],
      displayAs: tileData['displayas'],
      label: tileData['label'],
      removable: true, // Will be overridden by Dock.fromXML based on collection key
    });
  }
}

export interface DockOptions {
  payloadScope?: 'System' | 'User';
  payloadDisplayName?: string;
  payloadOrganization?: string;
  payloadDescription?: string;
  dockContentsImmutable?: boolean;
  dockStaticOnly?: boolean;
  dockTileSize?: number;
  dockPosition?: 'left' | 'bottom' | 'right';
}

export class Dock {
  payloadScope: 'System' | 'User' = 'System';
  payloadDisplayName: string = 'Custom Dock';
  payloadOrganization?: string;
  payloadDescription?: string;
  payloadUUID: string = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().toUpperCase() : 'BADD1E-UUID-FALLBACK-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  payloadIdentifier: string = '';

  dockContentsImmutable: boolean = false;
  dockStaticOnly: boolean = false;
  dockTileSize: number = 68;
  dockPosition: 'left' | 'bottom' | 'right' = 'bottom';

  staticApps: DockItem[] = [];
  persistentApps: DockItem[] = [];
  staticOthers: DockItem[] = [];
  persistentOthers: DockItem[] = [];

  constructor(options: DockOptions = {}) {
    Object.assign(this, options);
    this.updateIdentifier();
  }

  updateIdentifier() {
    this.payloadIdentifier = this.payloadDisplayName.toLowerCase().replace(/\s+/g, '');
  }

  addItem(item: DockItem) {
    if (item.tileType === 'file-tile' && !item.cfurlString.endsWith('.webloc')) {
      if (item.removable) {
        this.persistentApps.push(item);
      } else {
        this.staticApps.push(item);
      }
    } else {
      if (item.removable) {
        this.persistentOthers.push(item);
      } else {
        this.staticOthers.push(item);
      }
    }
  }

  generateUniversalObject(): any {
    const obj: any = {
      'contents-immutable': this.dockContentsImmutable,
      'tilesize': this.dockTileSize,
      'orientation': this.dockPosition,
    };

    if (this.staticApps.length > 0) {
      obj['static-apps'] = this.staticApps.map(i => i.generateDockItemXML());
    }
    if (this.staticOthers.length > 0) {
      obj['static-others'] = this.staticOthers.map(i => i.generateDockItemXML());
    }

    return obj;
  }

  generateProfileXML(): string {
    const dockPayloadUUID = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().toUpperCase() : 'C0FFEE-PAYLOAD-FALLBACK-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const dockPayloadContent = {
      ...this.generateUniversalObject(),
      'PayloadType': 'com.apple.dock',
      'PayloadVersion': 1,
      'PayloadIdentifier': `dockmaster.${this.payloadIdentifier}`,
      'PayloadEnabled': true,
      'PayloadUUID': dockPayloadUUID,
      'PayloadDisplayName': 'Dock',
      'static-only': this.dockStaticOnly,
    };

    const profile: any = {
      'PayloadIdentifier': this.payloadIdentifier,
      'PayloadRemovalDisallowed': true,
      'PayloadScope': this.payloadScope,
      'PayloadType': 'Configuration',
      'PayloadUUID': this.payloadUUID,
      'PayloadVersion': 1,
      'PayloadDisplayName': this.payloadDisplayName,
      'PayloadContent': [dockPayloadContent],
    };

    if (this.payloadOrganization) profile['PayloadOrganization'] = this.payloadOrganization;
    if (this.payloadDescription) profile['PayloadDescription'] = this.payloadDescription;

    return plist.build(profile as any);
  }

  generatePlistXML(): string {
    const obj = {
      ...this.generateUniversalObject(),
      'version': 1,
    };

    if (this.persistentApps.length > 0) {
      obj['persistent-apps'] = this.persistentApps.map(i => i.generateDockItemXML());
    }
    if (this.persistentOthers.length > 0) {
      obj['persistent-others'] = this.persistentOthers.map(i => i.generateDockItemXML());
    }

    return plist.build(obj as any);
  }

  static fromXML(xmlString: string): Dock {
    const parsed = plist.parse(xmlString) as any;
    let dockData = parsed;

    // Check if it's a .mobileconfig (Configuration Profile)
    if (parsed.PayloadContent && Array.isArray(parsed.PayloadContent)) {
      const dockPayload = parsed.PayloadContent.find((p: any) => p.PayloadType === 'com.apple.dock');
      if (dockPayload) {
        dockData = dockPayload;
      }
    }

    const options: DockOptions = {
      payloadDisplayName: parsed.PayloadDisplayName || 'Imported Dock',
      payloadOrganization: parsed.PayloadOrganization,
      payloadDescription: parsed.PayloadDescription,
      payloadScope: parsed.PayloadScope,
      dockContentsImmutable: dockData['contents-immutable'],
      dockStaticOnly: dockData['static-only'],
      dockTileSize: dockData['tilesize'],
      dockPosition: dockData['orientation'],
    };

    const dock = new Dock(options);
    if (parsed.PayloadUUID) dock.payloadUUID = parsed.PayloadUUID;

    const processItems = (key: string, removable: boolean) => {
      if (dockData[key] && Array.isArray(dockData[key])) {
        dockData[key].forEach((itemData: any) => {
          const item = DockItem.fromXML(itemData);
          item.removable = removable;
          dock.addItem(item);
        });
      }
    };

    processItems('static-apps', false);
    processItems('persistent-apps', true);
    processItems('static-others', false);
    processItems('persistent-others', true);

    return dock;
  }
}
