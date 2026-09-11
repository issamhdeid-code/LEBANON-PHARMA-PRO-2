import { io, Socket } from 'socket.io-client';
import { SyncStatus } from '../types/pharmacy';

type SyncPayload = {
  type: 'STOCK_MUTATION' | 'SALE_CREATED' | 'PRICE_UPDATE' | 'PRODUCT_DELETED'
      | 'SALE_UPDATED' | 'SALE_DELETED' | 'SUPPLIER_UPSERT' | 'SUPPLIER_DELETED' | 'CUSTOMER_UPSERT'
      | 'PURCHASE_CREATED' | 'PURCHASE_UPDATED' | 'PURCHASE_DELETED' | 'USER_UPSERT' | 'USER_DELETED' | 'SETTINGS_UPDATE'
      | 'USER_SESSION';
  data: any;
  senderId: string;
};

class SyncEngine {
  private socket: Socket | null = null;
  private mode: 'main' | 'secondary' = 'main';
  private targetIp: string = '';
  private deviceId: string = Math.random().toString(36).substring(7);
  private status: SyncStatus = 'offline';
  
  private onStatusChange?: (status: SyncStatus) => void;
  private onMessage?: (payload: SyncPayload) => void;
  // Fired on the Main PC when a Secondary PC asks for a full data snapshot after connecting.
  // requesterData is whatever the Secondary recorded locally (e.g. while it was offline).
  private onSnapshotRequested?: (requesterId: string, requesterData: any) => void;
  // Fired on the Secondary PC when the Main PC replies with a full data snapshot
  private onSnapshotData?: (data: any) => void;
  // Supplies this device's own current data when requesting a snapshot, so a reconnecting
  // Secondary's offline work can be merged into Main instead of silently discarded.
  private getLocalSnapshot?: () => any;

  init(
    mode: 'main' | 'secondary',
    targetIp: string,
    onStatusChange: (status: SyncStatus) => void,
    onMessage: (payload: SyncPayload) => void,
    onSnapshotRequested?: (requesterId: string, requesterData: any) => void,
    onSnapshotData?: (data: any) => void,
    getLocalSnapshot?: () => any
  ) {
    this.mode = mode;
    this.targetIp = targetIp;
    this.onStatusChange = onStatusChange;
    this.onMessage = onMessage;
    this.onSnapshotRequested = onSnapshotRequested;
    this.onSnapshotData = onSnapshotData;
    this.getLocalSnapshot = getLocalSnapshot;

    this.connect();
  }

  private connect() {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.updateStatus('connecting');

    // In a web environment, if Main, connect to the same origin (the cloud server).
    // If Secondary, connect to the provided IP (or the cloud server if empty).
    // For local Electron apps, 'main' means connect to localhost:3000.
    
    let serverUrl = '';
    
    if (typeof window !== 'undefined') {
      const isWebPreview = window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost');
      
      if (this.mode === 'main') {
        serverUrl = isWebPreview ? window.location.origin : 'http://127.0.0.1:3000';
      } else {
        // secondary
        serverUrl = this.targetIp || window.location.origin;
        // ensure http:// prefix if missing
        if (serverUrl && !serverUrl.startsWith('http')) {
          serverUrl = 'http://' + serverUrl;
        }
        // Auto-append port 3000 if it's a local network IP and the user forgot to type the port
        if (serverUrl.startsWith('http://') && !serverUrl.includes('.run.app') && serverUrl.split(':').length === 2) {
          serverUrl = serverUrl + ':3000';
        }
      }
    } else {
       serverUrl = this.mode === 'main' ? 'http://127.0.0.1:3000' : (this.targetIp || 'http://127.0.0.1:3000');
    }

    try {
      this.socket = io(serverUrl, {
        reconnectionDelayMax: 10000,
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        this.updateStatus('connected');
        // Secondary PC pulls a full data snapshot from Main right after (re)connecting, sending
        // along its own local data so Main can absorb anything recorded while disconnected.
        if (this.mode === 'secondary' && this.socket) {
          this.socket.emit('request_snapshot', this.getLocalSnapshot ? this.getLocalSnapshot() : null);
        }
      });

      this.socket.on('disconnect', () => {
        this.updateStatus('offline');
      });
      
      this.socket.on('connect_error', () => {
        this.updateStatus('error');
      });

      this.socket.on('sync_update', (payload: SyncPayload) => {
        if (payload.senderId !== this.deviceId) {
           if (this.onMessage) {
             this.onMessage(payload);
           }
        }
      });

      this.socket.on('snapshot_requested', ({ requesterId, requesterData }: { requesterId: string; requesterData: any }) => {
        if (this.onSnapshotRequested) {
          this.onSnapshotRequested(requesterId, requesterData);
        }
      });

      this.socket.on('snapshot_data', (data: any) => {
        if (this.onSnapshotData) {
          this.onSnapshotData(data);
        }
      });
    } catch (e) {
      this.updateStatus('error');
    }
  }

  private updateStatus(newStatus: SyncStatus) {
    this.status = newStatus;
    if (this.onStatusChange) {
      this.onStatusChange(newStatus);
    }
  }

  public broadcast(type: SyncPayload['type'], data: any) {
    if (this.socket && this.status === 'connected') {
      const payload: SyncPayload = {
        type,
        data,
        senderId: this.deviceId
      };
      this.socket.emit('sync_update', payload);
    }
  }

  // Main PC sends its full dataset directly to the requesting Secondary PC
  public sendSnapshot(targetId: string, data: any) {
    if (this.socket && this.status === 'connected') {
      this.socket.emit('snapshot_response', { targetId, data });
    }
  }
  
  public disconnect() {
     if (this.socket) {
         this.socket.disconnect();
         this.socket = null;
     }
     this.updateStatus('offline');
  }
}

export const syncEngine = new SyncEngine();
