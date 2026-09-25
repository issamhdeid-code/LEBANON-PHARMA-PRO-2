import { io, Socket } from 'socket.io-client';
import { SyncStatus } from '../types/pharmacy';

export const SYNC_PROTOCOL_VERSION = 1;

type SyncPayload = {
  type: 'STOCK_MUTATION' | 'SALE_CREATED' | 'PRICE_UPDATE' | 'PRODUCT_DELETED'
      | 'SALE_UPDATED' | 'SALE_DELETED' | 'SUPPLIER_UPSERT' | 'SUPPLIER_DELETED' | 'CUSTOMER_UPSERT' | 'CUSTOMER_DELETED'
      | 'CUSTOMER_PAYMENT_UPSERT' | 'CUSTOMER_PAYMENT_DELETED'
      | 'SUPPLIER_PAYMENT_UPSERT' | 'SUPPLIER_PAYMENT_DELETED'
      | 'PURCHASE_CREATED' | 'PURCHASE_UPDATED' | 'PURCHASE_DELETED'
      | 'PURCHASE_RETURN_CREATED' | 'PURCHASE_RETURN_DELETED'
      | 'SALE_RETURN_CREATED' | 'SALE_RETURN_DELETED'
      | 'EXPENSE_CREATED' | 'EXPENSE_DELETED'
      | 'USER_UPSERT' | 'USER_DELETED' | 'SETTINGS_UPDATE'
      | 'CLEAR_ALL_DATA'
      | 'USER_SESSION'
      | 'YEAR_CLOSED';
  data: any;
  senderId: string;
  protocol?: number;
};

// Cap on queued offline mutations so a long outage can't balloon memory.
const MAX_PENDING_PAYLOADS = 500;

class SyncEngine {
  private socket: Socket | null = null;
  private mode: 'main' | 'secondary' = 'main';
  private targetIp: string = '';
  private deviceId: string = Math.random().toString(36).substring(7);
  private status: SyncStatus = 'offline';
  private pendingQueue: SyncPayload[] = [];

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
        serverUrl = (this.targetIp || '').trim() || window.location.origin;
        if (serverUrl && !serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
          const isHttps = (typeof window !== 'undefined' && window.location.protocol === 'https:') || serverUrl.includes('.run.app');
          serverUrl = (isHttps ? 'https://' : 'http://') + serverUrl;
        }
        if (serverUrl.includes('.run.app') && serverUrl.startsWith('http://')) {
          serverUrl = serverUrl.replace('http://', 'https://');
        }
        // Auto-append port 3000 if it's a local network IP and the user forgot to type the port
        if (serverUrl.startsWith('http://') && !serverUrl.includes('.run.app') && serverUrl.split(':').length === 2) {
          serverUrl = serverUrl + ':3000';
        }
        serverUrl = serverUrl.replace(/\/+$/, '');
      }
    } else {
      serverUrl = this.mode === 'main' ? 'http://127.0.0.1:3000' : (this.targetIp || 'http://127.0.0.1:3000');
    }

    try {
      this.socket = io(serverUrl, {
        reconnectionDelayMax: 10000,
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        this.updateStatus('connected');
        // Flush mutations recorded while the socket was out (offline retry queue).
        this.flushPendingQueue();
        // Secondary PC pulls a full data snapshot from Main right after (re)connecting, sending
        // along its own local data so Main can absorb anything recorded while disconnected.
        if (this.mode === 'secondary' && this.socket) {
          this.socket.emit('request_snapshot', this.getLocalSnapshot ? this.getLocalSnapshot() : null);
        }
      });

      this.socket.on('disconnect', () => {
        this.updateStatus('offline');
      });
      
      this.socket.on('connect_error', (err) => {
        this.updateStatus('error');
      });

      this.socket.on('sync_update', (payload: SyncPayload) => {
        // Ignore messages from ourselves, from a different protocol version,
        // or malformed payloads.
        if (payload?.senderId === this.deviceId) return;
        if (payload?.protocol !== undefined && payload?.protocol !== SYNC_PROTOCOL_VERSION) return;
        if (this.onMessage) {
          this.onMessage(payload);
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

  private buildPayload(type: SyncPayload['type'], data: any): SyncPayload {
    return {
      type,
      data,
      senderId: this.deviceId,
      protocol: SYNC_PROTOCOL_VERSION,
    };
  }

  private flushPendingQueue() {
    if (this.pendingQueue.length === 0 || !this.socket) return;
    const queued = this.pendingQueue.splice(0, this.pendingQueue.length);
    for (const payload of queued) {
      this.socket.emit('sync_update', payload);
    }
  }

  public broadcast(type: SyncPayload['type'], data: any) {
    const payload = this.buildPayload(type, data);
    if (this.socket && this.status === 'connected') {
      this.socket.emit('sync_update', payload);
      return;
    }
    // Offline: keep the mutation so it isn't permanently lost during a network blip.
    // De-duplicate by (type + id) when possible, then push newest-last.
    const id = data?.id ?? data?.code;
    if (id !== undefined) {
      const dupIndex = this.pendingQueue.findIndex((p) => p.type === type && (p.data?.id ?? p.data?.code) === id);
      if (dupIndex !== -1) this.pendingQueue.splice(dupIndex, 1);
    }
    this.pendingQueue.push(payload);
    if (this.pendingQueue.length > MAX_PENDING_PAYLOADS) {
      this.pendingQueue.splice(0, this.pendingQueue.length - MAX_PENDING_PAYLOADS);
    }
  }

  // Main PC sends its full dataset directly to the requesting Secondary PC
  public sendSnapshot(targetId: string, data: any) {
    if (this.socket && this.status === 'connected') {
      this.socket.emit('snapshot_response', { targetId, data });
    }
  }

  public pendingCount(): number {
    return this.pendingQueue.length;
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