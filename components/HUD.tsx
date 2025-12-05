import React from 'react';
import { SimStatus, MissionParams } from '../types';

interface HUDProps {
  status: SimStatus;
  mission: MissionParams | null;
  targetDist: number;
  interceptorVel: number;
  onNewMission: () => void;
  onDebrief: () => void;
  loading: boolean;
  debriefText: string;
}

const HUD: React.FC<HUDProps> = ({
  status,
  mission,
  targetDist,
  interceptorVel,
  onNewMission,
  onDebrief,
  loading,
  debriefText
}) => {
  return (
    <div className="absolute top-0 left-0 p-6 pointer-events-none w-full h-full flex flex-col justify-between z-10">
      
      {/* Top Left: Status Block */}
      <div className="bg-green-950/80 border border-green-500 p-4 rounded-md max-w-sm pointer-events-auto backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.2)]">
        <h1 className="text-xl font-bold text-green-400 tracking-widest border-b border-green-600 pb-2 mb-3 uppercase">
          Drone Defense AI
        </h1>
        
        <div className="space-y-1 font-mono text-sm text-green-300">
          <div className="flex justify-between">
            <span>SYS.MODE:</span>
            <span className="text-white">AUTO-INTERCEPT</span>
          </div>
          <div className="flex justify-between">
            <span>STATUS:</span>
            <span className={`${status === SimStatus.FAILURE ? 'text-red-500 animate-pulse' : status === SimStatus.SUCCESS ? 'text-green-400' : 'text-yellow-400'}`}>
              {status}
            </span>
          </div>
          <div className="h-px bg-green-700 my-2 opacity-50" />
          <div className="flex justify-between">
            <span>TARGET RANGE:</span>
            <span>{targetDist.toFixed(2)}m</span>
          </div>
          <div className="flex justify-between">
            <span>VELOCITY:</span>
            <span>{interceptorVel.toFixed(2)}m/s</span>
          </div>
        </div>
      </div>

      {/* Middle Center: Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-white/30 rounded-full flex items-center justify-center pointer-events-none">
        <div className="w-1 h-1 bg-green-500 rounded-full animate-ping" />
      </div>

      {/* Bottom Left: Mission Log & Controls */}
      <div className="pointer-events-auto max-w-md space-y-4">
        
        {/* Mission Briefing Panel */}
        {mission && (
          <div className="bg-black/80 border border-cyan-700 p-4 rounded text-cyan-400 font-mono text-xs">
            <h3 className="font-bold text-cyan-300 mb-1">CURRENT MISSION: {mission.missionName}</h3>
            <p className="opacity-80 leading-relaxed">
              {mission.briefing}
            </p>
          </div>
        )}

        {/* Debrief Panel */}
        {debriefText && (
          <div className="bg-black/80 border-l-4 border-yellow-600 p-4 text-yellow-100 font-mono text-xs animate-in slide-in-from-left-10 fade-in duration-500">
            <strong className="block text-yellow-500 mb-1">TACTICAL DEBRIEF:</strong>
            {debriefText}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          <button 
            onClick={onNewMission}
            disabled={loading}
            className={`flex-1 py-3 px-4 font-bold uppercase tracking-wider text-sm border transition-all duration-200
              ${loading 
                ? 'bg-gray-900 border-gray-700 text-gray-500 cursor-wait' 
                : 'bg-green-900/50 border-green-500 text-green-400 hover:bg-green-500 hover:text-black hover:shadow-[0_0_20px_rgba(0,255,0,0.4)]'
              }`}
          >
            {loading ? 'Processing...' : 'Generate Mission'}
          </button>
          
          {(status === SimStatus.SUCCESS || status === SimStatus.FAILURE) && (
            <button 
                onClick={onDebrief}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-yellow-900/40 border border-yellow-500 text-yellow-400 font-bold uppercase text-sm hover:bg-yellow-500 hover:text-black transition-all"
            >
                AI Debrief
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HUD;
