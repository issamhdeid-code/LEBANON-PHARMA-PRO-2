import { AppNotification } from '../types/pharmacy';

export class NotificationManager {
  private hasPermission: boolean = false;

  constructor() {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        this.hasPermission = Notification.permission === 'granted';
      }
    } catch {
      this.hasPermission = false;
    }
  }

  public async requestDesktopPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    } catch {
      return false;
    }
  }

  public showPush(
    title: string,
    message: string,
    type: AppNotification['type'] = 'inventory',
    severity: AppNotification['severity'] = 'warning'
  ): AppNotification {
    // Trigger native browser notification if granted
    if (this.hasPermission && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        new Notification(`🏥 ${title}`, {
          body: message,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('Desktop notification display failed', err);
      }
    }

    return {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title,
      message,
      type,
      severity,
      timestamp: Date.now(),
      read: false,
    };
  }
}

export const notificationService = new NotificationManager();
