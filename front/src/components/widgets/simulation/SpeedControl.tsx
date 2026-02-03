import React from 'react';

interface SpeedControlProps {
    currentSpeed: number;
    setSpeed: (speed: number) => void;
}

const SpeedControl: React.FC<SpeedControlProps> = ({ currentSpeed, setSpeed }) => {
    return (
        <div className="absolute top-lg left-lg z-popup bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl p-xl min-w-[320px] transition-slow hover:shadow-[0_25px_50px_-12px_rgba(59,130,246,0.2)]">
            {/* Header with Speed Indicator */}
            <div className="flex justify-between items-center mb-lg">
                <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-xl bg-gradient-blue-purple flex items-center justify-center shadow-lg">
                        <svg className="w-2xl h-2xl text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div className="speed-title">
                        <h4 className="font-bold text-base text-text-primary m-0">Simulation Speed</h4>
                        <p className="text-sm text-gray-400 m-0">Real-time control</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-black bg-gradient-to-r from-blue-light to-purple-light bg-clip-text text-transparent">
                        {currentSpeed.toFixed(3)}x
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Multiplier</div>
                </div>
            </div>



            {/* Speed Slider */}
            <div className="mb-lg">
                <input
                    type="range"
                    min="0.001"
                    max="10"
                    step="0.001"
                    // Use local state if we want smooth sliding without flooding backend
                    // But we need to sync with props.currentSpeed too.
                    defaultValue={currentSpeed}
                    onMouseUp={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))}
                    onTouchEnd={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))}
                    className="w-full h-sm rounded-lg appearance-none cursor-pointer outline-none
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-xl [&::-webkit-slider-thumb]:h-xl [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-blue-purple [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-normal [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:shadow-[0_10px_15px_-3px_rgba(59,130,246,0.5)]
                        [&::-moz-range-thumb]:w-xl [&::-moz-range-thumb]:h-xl [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gradient-blue-purple [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:transition-normal [&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:hover:shadow-[0_10px_15px_-3px_rgba(59,130,246,0.5)]"
                    style={{
                        background: `linear-gradient(to right, rgb(59, 130, 246) 0%, rgb(168, 85, 247) ${(currentSpeed / 10) * 100}%, rgb(55, 65, 81) ${(currentSpeed / 10) * 100}%)`
                    }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-sm px-xs">
                    <span>Slow</span>
                    <span>Normal</span>
                    <span>Fast</span>
                </div>
            </div>

            {/* Preset Buttons */}
            <div className="grid grid-cols-5 gap-sm">
                {[0.001, 0.1, 1.0, 5.0, 10.0].map((speed) => (
                    <button
                        key={speed}
                        onClick={() => setSpeed(speed)}
                        className={`px-md py-sm text-sm font-bold rounded-lg transition-normal border-none cursor-pointer hover:bg-gray-600/50 hover:scale-105 ${Math.abs(currentSpeed - speed) < 0.05
                                ? 'bg-gradient-blue-purple text-text-primary shadow-[0_10px_15px_-3px_rgba(59,130,246,0.5)] scale-105'
                                : 'bg-gray-700/50 text-gray-300'
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
