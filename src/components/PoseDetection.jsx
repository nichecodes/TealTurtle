import React, { useState, useRef, useEffect } from 'react';
import ml5 from 'ml5';
import p5 from 'p5';

const HandDetection = ({ onHandGrab, containerRef }) => {
  const [handDetected, setHandDetected] = useState(false);
  const sketchRef = useRef();

  useEffect(() => {
    let handPose;
    let video;
    let hands = [];

    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(640, 480);
        video = p.createCapture(p.VIDEO);
        video.size(640, 480);
        video.hide(); // Hide the default video element so we only see the canvas

        // Initialize the handPose model
        handPose = ml5.handPose();

        // Start detecting hands from the webcam video
        // This follows the ml5 example that uses detectStart with a callback.
        handPose.detectStart(video, gotHands);
      };

      // Callback function for when handPose outputs data.
      function gotHands(results) {
        hands = results;
        setHandDetected(results.length > 0);
        if (results.length > 0 && onHandGrab) {
          onHandGrab(results);
        }
      }

      p.draw = () => {
        // Draw the webcam video onto the canvas
        p.image(video, 0, 0, p.width, p.height);

        // Draw all the tracked hand keypoints
        for (let i = 0; i < hands.length; i++) {
          const hand = hands[i];
          for (let j = 0; j < hand.keypoints.length; j++) {
            const keypoint = hand.keypoints[j];
            p.fill(0, 255, 0);
            p.noStroke();
            p.circle(keypoint.x, keypoint.y, 10);
          }
        }
      };
    };

    // Instantiate the p5 sketch within the provided containerRef
    sketchRef.current = new p5(sketch, containerRef.current);

    // Cleanup on unmount: remove the p5 sketch
    return () => {
      if (sketchRef.current) {
        sketchRef.current.remove();
      }
    };
  }, [containerRef, onHandGrab]);

  return (
    <div>
      <div ref={containerRef}></div>
      {handDetected && <h1>Success :)</h1>}
    </div>
  );
};

export default HandDetection;
