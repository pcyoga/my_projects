/**
 * PostureCare IndexedDB Client-Side Database Engine
 * Provides an asynchronous, transactional, indexed storage subsystem
 * for high-throughput ergonomic telemetry, range queries, and aggregations.
 */

import { PostureSession, PostureAlert, UserGoal } from '../types';

const DB_NAME = 'PostureCareDB';
const DB_VERSION = 2;

export interface DBPostureSession extends PostureSession {
  dateBucket?: string; // YYYY-MM-DD for fast date grouping
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private isSupported: boolean = typeof window !== 'undefined' && 'indexedDB' in window;

  public async getDB(): Promise<IDBDatabase | null> {
    if (!this.isSupported) return null;
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDB] Failed to open database:', request.error);
        resolve(null);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Posture Sessions Store with B-Tree Indexes
        if (!db.objectStoreNames.contains('posture_sessions')) {
          const sessionStore = db.createObjectStore('posture_sessions', { keyPath: 'id' });
          sessionStore.createIndex('by_user', 'userId', { unique: false });
          sessionStore.createIndex('by_start_time', 'startTime', { unique: false });
          sessionStore.createIndex('by_user_and_time', ['userId', 'startTime'], { unique: false });
          sessionStore.createIndex('by_average_score', 'averageScore', { unique: false });
          sessionStore.createIndex('by_date_bucket', 'dateBucket', { unique: false });
        }

        // 2. Posture Alerts Store
        if (!db.objectStoreNames.contains('posture_alerts')) {
          const alertStore = db.createObjectStore('posture_alerts', { keyPath: 'id' });
          alertStore.createIndex('by_session', 'sessionId', { unique: false });
          alertStore.createIndex('by_timestamp', 'timestamp', { unique: false });
          alertStore.createIndex('by_deviation', 'deviationType', { unique: false });
        }

        // 3. User Goals Store
        if (!db.objectStoreNames.contains('user_goals')) {
          const goalStore = db.createObjectStore('user_goals', { keyPath: 'id' });
          goalStore.createIndex('by_status', 'status', { unique: false });
        }
      };
    });
  }

  /**
   * Saves a session transactionally into the IndexedDB store.
   */
  public async saveSession(session: PostureSession, alerts?: PostureAlert[]): Promise<boolean> {
    const db = await this.getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(['posture_sessions', 'posture_alerts'], 'readwrite');
      const sessionStore = tx.objectStore('posture_sessions');
      const alertStore = tx.objectStore('posture_alerts');

      const dateBucket = session.startTime ? session.startTime.substring(0, 10) : new Date().toISOString().substring(0, 10);
      sessionStore.put({ ...session, dateBucket });

      if (alerts && alerts.length > 0) {
        alerts.forEach((alt) => alertStore.put(alt));
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  /**
   * Effective Retrieval: Queries sessions within a date range using the 'by_start_time' index.
   * Avoids scanning unrelated entries.
   */
  public async getSessionsByDateRange(startDateISO: string, endDateISO: string): Promise<PostureSession[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction('posture_sessions', 'readonly');
      const store = tx.objectStore('posture_sessions');
      const index = store.index('by_start_time');
      const range = IDBKeyRange.bound(startDateISO, endDateISO);
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  /**
   * Effective Retrieval: Computes aggregated posture analytics (rolling average, time distribution).
   */
  public async getAggregatedMetrics(days: number = 7): Promise<{
    sessionCount: number;
    avgScore: number;
    totalMonitoredMinutes: number;
    goodPercent: number;
    totalAlerts: number;
  }> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const sessions = await this.getSessionsByDateRange(cutoffDate, new Date().toISOString());

    if (!sessions || sessions.length === 0) {
      return {
        sessionCount: 0,
        avgScore: 0,
        totalMonitoredMinutes: 0,
        goodPercent: 0,
        totalAlerts: 0
      };
    }

    let totalScore = 0;
    let totalSeconds = 0;
    let goodSeconds = 0;
    let alerts = 0;

    for (const s of sessions) {
      totalScore += s.averageScore || 0;
      totalSeconds += s.durationSeconds || 0;
      goodSeconds += s.goodSeconds || 0;
      alerts += s.alertCount || 0;
    }

    return {
      sessionCount: sessions.length,
      avgScore: Math.round((totalScore / sessions.length) * 10) / 10,
      totalMonitoredMinutes: Math.round(totalSeconds / 60),
      goodPercent: totalSeconds > 0 ? Math.round((goodSeconds / totalSeconds) * 100) : 0,
      totalAlerts: alerts
    };
  }

  /**
   * Retrieves all sessions sorted in descending order of time.
   */
  public async getAllSessionsSorted(): Promise<PostureSession[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction('posture_sessions', 'readonly');
      const store = tx.objectStore('posture_sessions');
      const index = store.index('by_start_time');
      const request = index.openCursor(null, 'prev');
      const results: PostureSession[] = [];

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => resolve([]);
    });
  }
}

export const indexedDBManager = new IndexedDBManager();
