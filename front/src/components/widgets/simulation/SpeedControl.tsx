import React, { useState } from 'react';
import { Input } from '../../ui/input';

interface SpeedControlProps {
    currentSpeed: number;
    setSpeed: (speed: number) => void;
}

const SpeedControl: React.FC<SpeedControlProps> = ({ currentSpeed, setSpeed }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div
            className="absolute top-lg left-lg z-popup group transition-all duration-500 ease-out"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <div className={`
                bg-gradient-to-br from-gray-900/30 to-gray-800/30 backdrop-blur-lg 
                border border-white/10 
                rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.1)]
                transition-all duration-500 ease-out overflow-hidden
                hover:border-blue-400/30 hover:shadow-[0_10px_40px_rgba(59,130,246,0.3)]
                ${isExpanded ? 'min-w-[340px] p-5' : 'w-14 h-14 p-0'}
            `}>
                {/* Collapsed State - Clock Icon */}
                <div className={`
                    flex items-center justify-center
                    transition-all duration-500 ease-out
                    ${isExpanded ? 'opacity-0 h-0 w-0 overflow-hidden' : 'opacity-100 w-14 h-14'}
                `}>
                    <svg
                        className="w-7 h-7 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>

                {/* Expanded State - Full Content */}
                <div className={`
                    transition-all duration-500 ease-out
                    ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}
                `}>
                    {/* Header with Speed Indicator */}
                    <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_4px_20px_rgba(59,130,246,0.4)]">
                                <svg
                                    className="w-6 h-6 text-white drop-shadow-md"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-base text-white m-0 drop-shadow-sm">Simulation Speed</h4>
                                <p className="text-xs text-gray-400 m-0">Real-time control</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                                {currentSpeed.toFixed(3)}x
                            </div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Multiplier</div>
                        </div>
                    </div>

                    {/* Speed Slider */}
                    <div className="mb-5">
                        <Input
                            type="range"
                            min="0.001"
                            max="10"
                            step="0.001"
                            defaultValue={currentSpeed}
                            onMouseUp={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))}
                            onTouchEnd={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))}
                            className="h-2 w-full cursor-pointer appearance-none rounded-lg border-0 bg-transparent px-0 py-0 shadow-none outline-none focus-visible:ring-0
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-blue-400 [&::-webkit-slider-thumb]:to-purple-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(59,130,246,0.6)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-200 [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:hover:shadow-[0_0_20px_rgba(59,130,246,0.8)]
                                [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-blue-400 [&::-moz-range-thumb]:to-purple-600 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(59,130,246,0.6)] [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:duration-200 [&::-moz-range-thumb]:hover:scale-125 [&::-moz-range-thumb]:hover:shadow-[0_0_20px_rgba(59,130,246,0.8)]"
                            style={{
                                background: `linear-gradient(to right, rgb(59, 130, 246) 0%, rgb(168, 85, 247) ${(currentSpeed / 10) * 100}%, rgb(55, 65, 81) ${(currentSpeed / 10) * 100}%)`
                            }}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-2 px-1 font-medium">
                            <span>Slow</span>
                            <span>Normal</span>
                            <span>Fast</span>
                        </div>
                    </div>

                    {/* Preset Buttons */}
                    <div className="grid grid-cols-5 gap-2">
                        {[0.001, 0.1, 1.0, 5.0, 10.0].map((speed) => (
                            <button
                                key={speed}
                                onClick={() => setSpeed(speed)}
                                className={`
                                    px-2 py-2 text-xs font-bold rounded-lg 
                                    transition-all duration-200 border-none cursor-pointer
                                    ${Math.abs(currentSpeed - speed) < 0.05
                                        ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-[0_4px_15px_rgba(59,130,246,0.5)] scale-105'
                                        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/60 hover:scale-105 hover:text-white'
                                    }
                                `}
                            >
                                {speed}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SpeedControl;
