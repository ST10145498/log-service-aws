 
/**
 * Log Entry Data Models
 */

export interface LogEntry {
  logId: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  logType: string;
}

export interface CreateLogInput {
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface CreateLogResponse {
  success: boolean;
  logId: string;
  timestamp: string;
  message?: string;
}

export interface ReadRecentResponse {
  count: number;
  logs: LogEntry[];
}