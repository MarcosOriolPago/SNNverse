import React from 'react';
import NodeFlowLayout from '../NodeLayout';
import { FiPlay } from 'react-icons/fi';

interface MainContentProps {
    isCollapsed: boolean;
}

const MainContent: React.FC<MainContentProps> = ({ isCollapsed }) => {
    const contentMargin = isCollapsed ? 'ml-16' : 'ml-64';

    return (
        <main className={`flex-1 relative h-screen bg-gray-50 dark:bg-gray-900 transition-all duration-300 ease-in-out ${contentMargin}`}>
            <NodeFlowLayout />
        </main>
    );
};

export default MainContent;