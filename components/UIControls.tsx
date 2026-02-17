import React, { useState } from 'react';
import { useStore } from '../store';
import { PRESETS, CoralType } from '../types';

export const UIControls: React.FC = () => {
  const {
    isPlaying,
    togglePlay,
    resetSimulation,
    preset,
    setParam,
    setPreset,
    setRenderParam,
    viewMode,
    setViewMode,
    showWireframe,
    toggleWireframe
  } = useStore();

  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const handleExport = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `coral-growth-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      link.click();
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 md:p-12 z-10 text-[#1A1A1A]">

      {/* Header */}
      <header className="flex justify-between items-start pointer-events-auto">
        <div>
          <h1 className="text-2xl font-light tracking-wide uppercase mb-1">Coral</h1>
          <p className="text-xs font-mono opacity-60">GENERATIVE SIMULATION /// DLA-01</p>
        </div>
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full border border-[#1A1A1A] opacity-50"></div>
          <div className="w-3 h-3 bg-[#1A1A1A] opacity-80"></div>
          <div className="w-3 h-3 border border-[#1A1A1A] opacity-50"></div>
        </div>
      </header>

      {/* Right Panel - Parameters */}
      <div className={`
        fixed right-0 top-0 h-full w-80 bg-[#F5F5F0]/90 backdrop-blur-sm
        border-l border-[#C9C5BA] transition-transform duration-500 ease-in-out pointer-events-auto
        flex flex-col
        ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-8 flex-1 overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider">Parameters</h2>
            <button onClick={() => setIsPanelOpen(false)} className="text-xl">&times;</button>
          </div>

          <div className="space-y-8">
            {/* View Mode Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase opacity-50">View Mode</label>
              <div className="flex border border-[#C9C5BA] rounded-sm overflow-hidden">
                <button
                  onClick={() => setViewMode('particles')}
                  className={`flex-1 py-2 text-xs uppercase transition-colors ${viewMode === 'particles' ? 'bg-[#1A1A1A] text-[#F5F5F0]' : 'hover:bg-gray-200'}`}
                >
                  Particles
                </button>
                <div className="w-px bg-[#C9C5BA]"></div>
                <button
                  onClick={() => setViewMode('solid')}
                  className={`flex-1 py-2 text-xs uppercase transition-colors ${viewMode === 'solid' ? 'bg-[#1A1A1A] text-[#F5F5F0]' : 'hover:bg-gray-200'}`}
                >
                  Solid
                </button>
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase opacity-50">Coral Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PRESETS) as CoralType[]).map(key => (
                  <button
                    key={key}
                    onClick={() => { setPreset(key); resetSimulation(); }}
                    className="px-3 py-2 text-xs border border-[#C9C5BA] hover:bg-[#1A1A1A] hover:text-[#F5F5F0] transition-colors text-left uppercase"
                  >
                    {PRESETS[key].name}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-[#C9C5BA] opacity-50" />

            {/* Growth Parameters — dynamic per preset */}
            <div className="space-y-6">
              {preset.sliders.map(slider => (
                <ControlSlider
                  key={slider.key}
                  label={slider.label}
                  value={preset.params[slider.key] ?? 0}
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  onChange={(v) => setParam(slider.key, v)}
                  desc={slider.desc}
                />
              ))}
            </div>

            <hr className="border-[#C9C5BA] opacity-50" />

            {/* Solid Mesh Settings */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold uppercase opacity-50 mb-4">Solid Mesh</h3>

              {/* Material Color & Texture */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <span className="text-xs uppercase font-medium">Color</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={preset.color}
                    onChange={(e) => setRenderParam({ color: e.target.value })}
                    className="w-8 h-8 rounded-full border border-[#C9C5BA] cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mb-6">
                <span className="text-xs uppercase font-medium">Edges</span>
                <button
                  onClick={toggleWireframe}
                  className={`w-10 h-5 rounded-full relative transition-colors ${showWireframe ? 'bg-[#1A1A1A]' : 'bg-[#C9C5BA]'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${showWireframe ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              <ControlSlider
                label="Resolution"
                value={preset.mcResolution}
                min={32} max={180} step={1}
                onChange={(v) => setRenderParam({ mcResolution: v })}
                desc="Grid size (Low: Fast, High: Sharp)"
              />
              <ControlSlider
                label="Isolation"
                value={preset.mcIsolation}
                min={10} max={200} step={1}
                onChange={(v) => setRenderParam({ mcIsolation: v })}
                desc="Thickness (Low: Thick, High: Thin)"
              />
              <ControlSlider
                label="Influence"
                value={preset.mcPointInfluence}
                min={1} max={50} step={1}
                onChange={(v) => setRenderParam({ mcPointInfluence: v })}
                desc="Blob size per particle"
              />
            </div>

          </div>
        </div>
      </div>

      {/* Toggle Button for Panel (visible when closed) */}
      {!isPanelOpen && (
        <button
          onClick={() => setIsPanelOpen(true)}
          className="fixed right-6 top-6 pointer-events-auto p-2 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F5F5F0] transition-colors"
        >
          <div className="space-y-1">
            <div className="w-5 h-0.5 bg-current"></div>
            <div className="w-5 h-0.5 bg-current"></div>
            <div className="w-5 h-0.5 bg-current"></div>
          </div>
        </button>
      )}

      {/* Bottom Action Bar */}
      <footer className="pointer-events-auto flex justify-center">
        <div className="flex space-x-3">
          <button
            onClick={resetSimulation}
            className="px-8 py-3 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F5F5F0] transition-colors text-xs font-bold uppercase tracking-widest"
          >
            Run
          </button>
          <button
            onClick={togglePlay}
            className="px-8 py-3 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F5F5F0] transition-colors text-xs font-bold uppercase tracking-widest"
          >
            {isPlaying ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={handleExport}
            className="px-8 py-3 bg-[#1A1A1A] text-[#F5F5F0] hover:bg-[#8B7E74] transition-colors text-xs font-bold uppercase tracking-widest"
          >
            Export 3D
          </button>
        </div>
      </footer>
    </div>
  );
};

// Helper for Sliders
const ControlSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  desc?: string;
}> = ({ label, value, min, max, step, onChange, desc }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-xs uppercase font-medium">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-0.5 bg-[#C9C5BA] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#1A1A1A] [&::-webkit-slider-thumb]:rounded-full"
    />
    {desc && <p className="text-[10px] opacity-50 leading-tight">{desc}</p>}
  </div>
);
