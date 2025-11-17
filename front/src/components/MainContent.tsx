// MainContent.tsx
import React from 'react';
import NodeFlowLayout from './NodeLayout';

interface MainContentProps {
    isCollapsed: boolean;
}

const MainContent: React.FC<MainContentProps> = ({ isCollapsed }) => {
    const contentMargin = isCollapsed ? 'ml-16' : 'ml-64';

    return (
        <main className={`flex-1 p-8 transition-margin duration-300 ease-in-out ${contentMargin}`}>
            <NodeFlowLayout />
        </main>
    );
};

export default MainContent;