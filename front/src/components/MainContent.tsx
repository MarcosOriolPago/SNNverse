// MainContent.tsx
import React from 'react';
import NodeFlowLayout from './NodeLayout';

interface MainContentProps {
    isCollapsed: boolean;
}

const MainContent: React.FC<MainContentProps> = ({ isCollapsed }) => {
    
    // Adjust margin/padding to prevent content from hiding behind the sidebar
    // w-16 (4rem) + p-3 (0.75rem) ≈ 4.75rem (ml-16)
    // w-64 (16rem) + p-3 (0.75rem) ≈ 16.75rem (ml-64)
    const contentMargin = isCollapsed ? 'ml-16' : 'ml-64';

    return (
        <main className={`flex-1 p-8 transition-margin duration-300 ease-in-out ${contentMargin}`}>
            <NodeFlowLayout />
        </main>
    );
};

export default MainContent;