import React from 'react';

interface IconProps {
    paths: string[];
    viewBox: string;
    className?: string;
}

const Icon: React.FC<IconProps> = ({ paths, viewBox, className }) => {
    return (
        <svg viewBox={viewBox} className={`fill-current ${className}`} xmlns="http://www.w3.org/2000/svg">
            {paths.map((d, i) => (
                <path key={i} d={d} />
            ))}
        </svg>
    );
};

export default Icon;