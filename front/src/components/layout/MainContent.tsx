import React from 'react';
import NodeFlowLayout from '../NodeLayout';
import '../../styles/main-content.css';

const MainContent: React.FC = () => {

    return (
        <main className="main-content">
            <NodeFlowLayout />
        </main>
    );
};

export default MainContent;