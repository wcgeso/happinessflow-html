import React from 'react';
import {
    Plane, Stethoscope, Palette, Hammer, Calculator, ShoppingBag, Wrench, BookOpen, Coffee,
    Scissors, Briefcase, Building2, Baby, Landmark, TreePine, Globe2, FerrisWheel, Leaf,
    Accessibility, Ambulance, Home, Rocket, Trophy, Star
} from 'lucide-react';

export const getProfessionIcon = (id: string, props: { className?: string; size?: number | string } = {}) => {
    switch (id) {
        case 'pilot': return <Plane {...props} />;
        case 'doctor': return <Stethoscope {...props} />;
        case 'artist': return <Palette {...props} />;
        case 'nest_builder': return <Hammer {...props} />;
        case 'accountant': return <Calculator {...props} />;
        case 'clerk': return <ShoppingBag {...props} />;
        case 'technician': return <Wrench {...props} />;
        case 'teacher': return <BookOpen {...props} />;
        case 'honey_brewer': return <Coffee {...props} />;
        case 'fashion_designer': return <Scissors {...props} />;
        default: return <Briefcase {...props} />;
    }
};

export const getEnterpriseIcon = (id: string, props: { className?: string; size?: number | string } = {}) => {
    switch (id) {
        case 'C01': return <Coffee {...props} />;
        case 'C02': return <Scissors {...props} />;
        case 'C03': return <Building2 {...props} />;
        case 'C04': return <Plane {...props} />;
        case 'C05': return <Baby {...props} />;
        case 'C06': return <Palette {...props} />;
        case 'C07': return <Stethoscope {...props} />;
        case 'C08': return <Landmark {...props} />;
        case 'C09': return <Wrench {...props} />;
        case 'C10': return <ShoppingBag {...props} />;
        default: return <Building2 {...props} />;
    }
};

export const getDreamIcon = (id: string, props: { className?: string; size?: number | string } = {}) => {
    switch (id) {
        case 'D01': return <TreePine {...props} />;
        case 'D02': return <Globe2 {...props} />;
        case 'D03': return <FerrisWheel {...props} />;
        case 'D04': return <Leaf {...props} />;
        case 'D05': return <Landmark {...props} />;
        case 'D06': return <Trophy {...props} />;
        case 'D07': return <Accessibility {...props} />;
        case 'D08': return <Ambulance {...props} />;
        case 'D09': return <Home {...props} />;
        case 'D10': return <Rocket {...props} />;
        default: return <Star {...props} />;
    }
};
