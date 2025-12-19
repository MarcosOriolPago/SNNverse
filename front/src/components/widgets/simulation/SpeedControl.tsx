import React from 'react';

interface SpeedControlProps {
    currentSpeed: number;
    setSpeed: (speed: number) => void;
}

const SpeedControl: React.FC<SpeedControlProps> = ({ currentSpeed, setSpeed }) => {
    return (
        <div className="speed-panel">
            {/* Header with Speed Indicator */}
            <div className="speed-header">
                <div className="speed-header-left">
                    <div className="speed-icon">
                        <svg className="speed-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div className="speed-title">
                        <h4>Simulation Speed</h4>
                        <p>Real-time control</p>
                    </div>
                </div>
                <div className="speed-display">
                    <div className="speed-number">
                        {currentSpeed.toFixed(3)}x
                    </div>
                    <div className="speed-multiplier">Multiplier</div>
                </div>
            </div>



            {/* Speed Slider */}
            <div className="speed-slider-container">
                <input
                    type="range"
                    min="0.001"
                    max="10"
                    step="0.001"
                    value={currentSpeed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="speed-slider-input"
                    style={{
                        background: `linear-gradient(to right, rgb(59, 130, 246) 0%, rgb(168, 85, 247) ${(currentSpeed / 10) * 100}%, rgb(55, 65, 81) ${(currentSpeed / 10) * 100}%)`
                    }}
                />
                <div className="speed-slider-labels">
                    <span>Slow</span>
                    <span>Normal</span>
                    <span>Fast</span>
                </div>
            </div>

            {/* Preset Buttons */}
            <div className="speed-presets">
                {[0.001, 0.1, 1.0, 5.0, 10.0].map((speed) => (
                    <button
                        key={speed}
                        onClick={() => setSpeed(speed)}
                        className={`preset-button ${Math.abs(currentSpeed - speed) < 0.05
                            ? 'active'
                            : ''
                            }`}
                    >
                        {speed}x
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SpeedControl;
