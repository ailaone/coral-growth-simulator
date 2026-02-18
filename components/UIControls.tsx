import React, { useState, useRef, useEffect } from 'react';
import { Mesh, Matrix4 } from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { useStore } from '../store';

export const UIControls: React.FC = () => {
  const {
    resetSimulation,
    triggerMesh,
    config,
    setParam,
    setRenderParam,
    meshTrigger,
    meshGeometry,
    showWireframe,
    showMesh,
    toggleWireframe,
    toggleShowMesh,
    paramsDirty,
    zoomExtents,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'growth' | 'mesh'>('growth');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const hasMesh = meshTrigger > 0;

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExportMenu]);

  const handleExportSTL = (zUp: boolean) => {
    if (!meshGeometry) return;
    setShowExportMenu(false);

    const geo = meshGeometry.clone();

    if (zUp) {
      // Rotate +90° around X: Y-up → Z-up (Rhino, most CAD)
      geo.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
    }

    const tempMesh = new Mesh(geo);
    const exporter = new STLExporter();
    const buffer = exporter.parse(tempMesh, { binary: true }) as DataView;

    const blob = new Blob([buffer.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    const axis = zUp ? 'zup' : 'yup';
    link.download = `coral-seed${Math.round(config.params.seed)}-gen${Math.round(config.params.generations)}-${axis}.stl`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    geo.dispose();
  };

  return (
    <>
      {/* Viewer overlay — header, hints, footer (left of panel) */}
      <div className="absolute inset-0 right-80 pointer-events-none flex flex-col justify-between p-6 md:p-12 z-10 text-[#1A1A1A]">

        {/* Header */}
        <header>
          <h1 className="text-5xl tracking-wide uppercase mb-2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>CORAL<span style={{ fontStyle: 'italic' }}>GEN</span></h1>
          <p className="text-xs font-mono opacity-60">GENERATIVE SIMULATION /// L-SYSTEM</p>
        </header>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Action Bar */}
        <footer className="pointer-events-auto flex justify-center">
          <div className="flex space-x-3">
            <button
              onClick={zoomExtents}
              title="Zoom to fit"
              className="px-3 py-3 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F5F5F0] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6V2h4" />
                <path d="M14 6V2h-4" />
                <path d="M2 10v4h4" />
                <path d="M14 10v4h-4" />
              </svg>
            </button>
            <button
              onClick={resetSimulation}
              className={`px-8 py-3 border transition-colors text-xs font-bold uppercase tracking-widest ${
                paramsDirty
                  ? 'bg-[#1A1A1A] text-[#F5F5F0] border-[#1A1A1A] animate-pulse'
                  : 'border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F5F5F0]'
              }`}
            >
              Run
            </button>
            <button
              onClick={() => { triggerMesh(); setActiveTab('mesh'); }}
              className="px-8 py-3 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F5F5F0] transition-colors text-xs font-bold uppercase tracking-widest"
            >
              Make 3D
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => meshGeometry && setShowExportMenu(!showExportMenu)}
                disabled={!meshGeometry}
                className={`px-8 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                  meshGeometry
                    ? 'bg-[#1A1A1A] text-[#F5F5F0] hover:bg-[#8B7E74]'
                    : 'bg-[#C9C5BA] text-[#F5F5F0]/50 cursor-not-allowed'
                }`}
              >
                Export STL
              </button>
              {showExportMenu && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#F5F5F0] border border-[#C9C5BA] shadow-lg min-w-[160px]">
                  <button
                    onClick={() => handleExportSTL(false)}
                    className="w-full px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-[#1A1A1A] hover:text-[#F5F5F0] transition-colors text-left"
                  >
                    Y-Up <span className="font-normal normal-case opacity-50">(Three.js)</span>
                  </button>
                  <button
                    onClick={() => handleExportSTL(true)}
                    className="w-full px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-[#1A1A1A] hover:text-[#F5F5F0] transition-colors text-left border-t border-[#C9C5BA]"
                  >
                    Z-Up <span className="font-normal normal-case opacity-50">(Rhino, CAD)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </footer>
      </div>

      {/* Controls hints — pinned to bottom corners of viewer */}
      <div className="absolute bottom-3 left-4 right-80 pointer-events-none z-10 flex justify-between items-end px-2 text-[10px] font-mono uppercase tracking-wider opacity-30 text-[#1A1A1A]">
        <div className="space-y-1">
          <div>&#x25E7; Click &amp; drag: Orbit</div>
          <div>&#x271B; Middle-click: Pan</div>
          <div>&#x2299; Scroll: Zoom</div>
        </div>
        <div className="space-y-1 text-right">
          <div>Trackpad: Orbit &#x261B;</div>
          <div>&#x2318;+Swipe: Zoom &#x2299;</div>
        </div>
      </div>

      {/* Right Panel - Always visible */}
      <div className="fixed right-0 top-0 h-full w-80 bg-[#F5F5F0]/90 backdrop-blur-sm border-l border-[#C9C5BA] flex flex-col z-10">
        <div className="p-8 flex-1 overflow-y-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-8">Parameters</h2>

          {/* Tab switcher */}
          <div className="flex space-x-1 mb-6 border-b border-[#C9C5BA]">
            <button
              onClick={() => setActiveTab('growth')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'growth'
                  ? 'border-b-2 border-[#1A1A1A] opacity-100'
                  : 'opacity-40 hover:opacity-70'
              }`}
            >
              Growth
            </button>
            <button
              onClick={() => setActiveTab('mesh')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'mesh'
                  ? 'border-b-2 border-[#1A1A1A] opacity-100'
                  : 'opacity-40 hover:opacity-70'
              }`}
            >
              Mesh
            </button>
          </div>

          {/* Growth tab */}
          {activeTab === 'growth' && (
            <div className="space-y-5">
              <p className="text-[10px] opacity-40">Re-run to apply changes</p>
              {config.sliders.map(slider => (
                <ControlSlider
                  key={slider.key}
                  label={slider.label}
                  value={config.params[slider.key] ?? 0}
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  onChange={(v) => setParam(slider.key, v)}
                  desc={slider.desc}
                />
              ))}
            </div>
          )}

          {/* Mesh tab */}
          {activeTab === 'mesh' && (
            <div className="space-y-6">
              {!hasMesh && (
                <p className="text-[10px] opacity-40">Click Make 3D to generate mesh</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-medium">Show Mesh</span>
                <button
                  onClick={toggleShowMesh}
                  className={`w-10 h-5 rounded-full relative transition-colors ${showMesh ? 'bg-[#1A1A1A]' : 'bg-[#C9C5BA]'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${showMesh ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-medium">Color</span>
                <input
                  type="color"
                  value={config.color}
                  onChange={(e) => setRenderParam({ color: e.target.value })}
                  className="w-8 h-8 rounded-full border border-[#C9C5BA] cursor-pointer overflow-hidden p-0"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-medium">Show Mesh Edges</span>
                <button
                  onClick={toggleWireframe}
                  className={`w-10 h-5 rounded-full relative transition-colors ${showWireframe ? 'bg-[#1A1A1A]' : 'bg-[#C9C5BA]'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${showWireframe ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              {showWireframe && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-medium">Edge Color</span>
                    <input
                      type="color"
                      value={config.edgeColor}
                      onChange={(e) => setRenderParam({ edgeColor: e.target.value })}
                      className="w-8 h-8 rounded-full border border-[#C9C5BA] cursor-pointer overflow-hidden p-0"
                    />
                  </div>
                  <ControlSlider
                    label="Edge Thickness"
                    value={config.edgeThickness}
                    min={0.2} max={3} step={0.1}
                    onChange={(v) => setRenderParam({ edgeThickness: v })}
                  />
                </>
              )}

              <ControlSlider
                label="Detail"
                value={config.mcResolution}
                min={32} max={300} step={1}
                onChange={(v) => setRenderParam({ mcResolution: v })}
                desc="Voxel density (scales with coral size)"
              />
              <ControlSlider
                label="Thickness"
                value={config.mcThickness}
                min={0} max={100} step={1}
                onChange={(v) => setRenderParam({ mcThickness: v })}
                desc="Low: Thin/detailed, High: Thick/fused"
              />
              <ControlSlider
                label="Blobiness (Experimental)"
                value={config.blobiness}
                min={0} max={2} step={0.1}
                onChange={(v) => setRenderParam({ blobiness: v })}
                desc="Adds metaball spheres at branch junctions"
              />
            </div>
          )}
        </div>
      </div>
    </>
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
