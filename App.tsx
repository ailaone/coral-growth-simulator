import React from 'react';
import { Experience } from './components/Experience';
import { UIControls } from './components/UIControls';

const App: React.FC = () => {
  return (
    <div className="relative w-full h-screen bg-[#F5F5F0]">
      <Experience />
      <UIControls />
    </div>
  );
};

export default App;