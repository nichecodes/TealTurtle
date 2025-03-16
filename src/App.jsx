import React, { useRef } from 'react';
import HandposeDemo from './components/PoseDetection.jsx';

const App = () => {
  const containerRef = useRef(null);

  const handleHandGrab = () => {
    console.log('Grab event triggered!');
  };

  return (
    <div ref={containerRef}>
      <h1>ML5 Hand Grab Demo</h1>
      <HandposeDemo onHandGrab={handleHandGrab} containerRef={containerRef} />
      {/* Your draggable component can listen to events or use state from here */}
    </div>
  );
};

export default App;