import React from 'react';
import NodeFlowLayout from '../NodeLayout';
import { STYLES } from '../../styles/main';

interface MainContentProps {
    isCollapsed: boolean;
}

const MainContent: React.FC<MainContentProps> = ({ isCollapsed }) => {
    const contentMargin = isCollapsed ? 'ml-16' : 'ml-64';

    return (
        <main className={`${STYLES.mainContent} ${contentMargin}`}>
            <NodeFlowLayout />
        </main>
    );
};

export default MainContent;