import React, { useState, useRef, useEffect } from 'react';
import ml5 from 'ml5';
import p5 from 'p5';

window.fingerTips = [];
window.knuckles = [];
const HandDetection = ({ onHandGrab, containerRef }) => {
  const [fistClosed, setFistClosed] = useState(false);
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
        video.hide(); // Hide the default video element

        // Initialize the handPose model
        handPose = ml5.handPose();
        // Start detecting hands from the webcam video
        handPose.detectStart(video, gotHands);
      };

      // Check if the hand forms a closed fist
      function isFistClosed(hand) {
        try {
          window.fingerTips = hand.keypoints.filter(point => point.name.includes('tip'));
          window.knuckles = hand.keypoints.filter(point => point.name.includes('mcp'));
        } catch (error) {
          return { result: false, points: null };
        }

        if (window.fingerTips.length === 5 && window.knuckles.length === 5) {
          let avgFingerTipsY = window.fingerTips.reduce((sum, tip) => sum + tip.y, 0) / window.fingerTips.length;
          let avgKnucklesY = window.knuckles.reduce((sum, knuckle) => sum + knuckle.y, 0) / window.knuckles.length;

          console.log(avgFingerTipsY);
          console.log(avgKnucklesY);

          if (avgFingerTipsY > avgKnucklesY) {
            let centerX = window.fingerTips.reduce((sum, tip) => sum + tip.x, 0) / window.fingerTips.length;
            let centerY = avgFingerTipsY;
            return { result: true, points: { x: centerX, y: centerY } };
          }
        }

        return { result: false, points: null };
      }

      // Callback for when handPose outputs data
      function gotHands(results) {
        hands = results;
        let fistStatus = false;
        if (results.length > 0) {
          fistStatus = isFistClosed(results[0]).result;
        }
        // Update the state to trigger UI changes
        setFistClosed(fistStatus);
        // Call the callback if a fist is detected
        if (fistStatus && onHandGrab) {
          onHandGrab(results);
        }
      }

      p.draw = () => {
        // Draw the webcam video onto the canvas
        p.image(video, 0, 0, p.width, p.height);
        // Draw all the tracked hand keypoints
        for (let i = 0; i < hands.length; i++) {
          const hand = hands[i];
          hand.keypoints.forEach((keypoint) => {
            p.fill(0, 255, 0);
            p.noStroke();
            p.circle(keypoint.x, keypoint.y, 10);
          });
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
      {fistClosed && <h1>Fist grabbed!</h1>}
    </div>
  );
};

export default HandDetection;
