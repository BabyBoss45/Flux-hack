'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export function ServiceStatusBanner() {
  const [isHealthy, setIsHealthy] = useState(true);
  const [checking, setChecking] = useState(true);

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/floor-plan/health');
      const data = await response.json();
      setIsHealthy(data.status === 'healthy');
    } catch (error) {
      setIsHealthy(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  // Don't show banner while checking initially or if service is healthy
  if (checking || isHealthy) {
    return null;
  }

  return (
    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-500 mb-1">
            AI Analysis Service Unavailable
          </h3>
          <p className="text-sm text-white/80">
            The LLM floor plan analysis service is not responding. Please ensure the Python service
            is running on port 8000.
          </p>
          <p className="text-xs text-white/60 mt-2">
            Run: <code className="px-1 py-0.5 bg-white/10 rounded">cd LLM && uv run uvicorn src.api:app --port 8000</code>
          </p>
        </div>
      </div>
    </div>
  );
}
