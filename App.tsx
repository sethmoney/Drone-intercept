import React, { useState, useRef, useCallback } from 'react';
import SimCanvas from './components/SimCanvas';
import HUD from './components/HUD';
import { generateMission, generateDebrief, playTTS } from './services/geminiService';
import { MissionParams, SimStatus, Vector3 } from './types';

function App() {
  // State
  const [status, setStatus] = useState<SimStatus>(SimStatus.IDLE);
  const [mission, setMission] = useState<MissionParams | null>(null);
  const [loading, setLoading] = useState(false);
  const [debriefText, setDebriefText] = useState("");
  
  // High-frequency stats
  const [targetDist, setTargetDist] = useState(0);
  const [interceptorVel, setInterceptorVel] = useState(0);
  
  // Sim parameters
  const [enemyPos, setEnemyPos] = useState<Vector3>({ x: 0, y: 100, z: 0 }); // Start hidden
  const [interceptorPos, setInterceptorPos] = useState<Vector3>({ x: 0, y: 0, z: 0 });

  // Refs for tracking mission data for debrief
  const startTimeRef = useRef<number>(0);
  const closestDistRef = useRef<number>(9999);

  const handleNewMission = async () => {
    setLoading(true);
    setDebriefText("");
    setStatus(SimStatus.IDLE);
    try {
      const newMission = await generateMission();
      setMission(newMission);
      
      // Setup Sim
      setEnemyPos(newMission.enemyPos);
      setInterceptorPos(newMission.interceptorPos);
      setStatus(SimStatus.ACTIVE);
      
      // Init tracking
      startTimeRef.current = Date.now();
      closestDistRef.current = 9999;
      
      // Audio
      await playTTS(`Mission ${newMission.missionName}. ${newMission.briefing}`);
      
    } catch (e) {
      console.error(e);
      alert("Failed to generate mission. Check API Key.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStats = useCallback((dist: number, vel: number) => {
    // Only update React state if changes are significant to save re-renders
    // In a production app, we'd pass refs to HUD, but this is fine for simple display
    setTargetDist(dist);
    setInterceptorVel(vel);
    
    if (dist < closestDistRef.current) {
        closestDistRef.current = dist;
    }
  }, []);

  const handleSimEnd = useCallback((finalStatus: SimStatus) => {
    setStatus(finalStatus);
  }, []);

  const handleDebrief = async () => {
    if (!mission) return;
    setLoading(true);
    try {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const text = await generateDebrief(status, duration, closestDistRef.current, mission.missionName);
        setDebriefText(text);
        await playTTS(text);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans">
      <div className="scanline" />
      
      <SimCanvas 
        status={status}
        enemyStartPos={enemyPos}
        interceptorStartPos={interceptorPos}
        onUpdateStats={handleUpdateStats}
        onSimEnd={handleSimEnd}
      />

      <HUD 
        status={status}
        mission={mission}
        targetDist={targetDist}
        interceptorVel={interceptorVel}
        onNewMission={handleNewMission}
        onDebrief={handleDebrief}
        loading={loading}
        debriefText={debriefText}
      />
    </div>
  );
}

export default App;
