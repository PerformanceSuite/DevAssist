/**
 * SessionManager - Handles development sessions with project isolation
 */

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

export class SessionManager {
  constructor() {
    this.dataPath = null;
    this.currentSession = null;
  }

  setDataPath(dataPath) {
    this.dataPath = dataPath;
  }

  async startSession(description = 'Development session') {
    if (!this.dataPath) {
      throw new Error('Data path not set');
    }

    await fs.mkdir(this.dataPath, { recursive: true });

    const session = {
      id: createHash('md5').update(Date.now().toString()).digest('hex').slice(0, 8),
      startTime: new Date().toISOString(),
      description,
      checkpoints: [],
      endTime: null,
    };

    this.currentSession = session;
    
    const sessionPath = path.join(this.dataPath, `${session.id}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));

    return session;
  }

  async createCheckpoint(summary) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const checkpoint = {
      time: new Date().toISOString(),
      summary,
    };

    this.currentSession.checkpoints.push(checkpoint);
    
    const sessionPath = path.join(this.dataPath, `${this.currentSession.id}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(this.currentSession, null, 2));

    return checkpoint;
  }

  async endSession() {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentSession.endTime = new Date().toISOString();
    
    const sessionPath = path.join(this.dataPath, `${this.currentSession.id}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(this.currentSession, null, 2));

    const duration = Math.round(
      (new Date(this.currentSession.endTime) - new Date(this.currentSession.startTime)) / 1000 / 60
    );

    const summary = `Session ${this.currentSession.id}
Duration: ${duration} minutes
Checkpoints: ${this.currentSession.checkpoints.length}
${this.currentSession.checkpoints.map(c => `• ${c.summary}`).join('\n')}`;

    this.currentSession = null;
    
    return summary;
  }

  async getStatus() {
    if (!this.currentSession) {
      return 'No active session';
    }

    const duration = Math.round(
      (Date.now() - new Date(this.currentSession.startTime).getTime()) / 1000 / 60
    );

    return `Active Session: ${this.currentSession.id}
Description: ${this.currentSession.description}
Duration: ${duration} minutes
Checkpoints: ${this.currentSession.checkpoints.length}`;
  }
}

export default SessionManager;
