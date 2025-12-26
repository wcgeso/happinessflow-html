import { Asset, HappinessItem, Enterprise, Dream } from '../types';

export const formatMoney = (amount: number) => {
    const lucky = Number(amount) || 0;
    return `${lucky.toLocaleString()} H`;
};

export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

export const getInitialHappinessList = (enterprise: Enterprise, dream: Dream): HappinessItem[] => {
    return [
        { id: 'h_finance', label: '實現幸福財務 (理財收入>總支出)', points: 30, checked: false, readOnly: true },
        { id: 'h_family', label: '實現幸福家庭 (完成5項)', points: 20, checked: false, readOnly: true },
        { id: 'h_date', label: '1. 第一次約會', points: 2, checked: false, readOnly: true },
        { id: 'h_proposal', label: '2. 難忘的求婚', points: 2, checked: false, readOnly: true },
        { id: 'h_wedding', label: '3. 浪漫的婚禮', points: 4, checked: false, readOnly: true },
        { id: 'h_child1', label: '4. 擁有第一個孩子', points: 4, checked: false, readOnly: true },
        { id: 'h_house_self', label: '5. 擁有自住的房子', points: 0, checked: false, readOnly: true },
        { id: 'h_house_1', label: '單間小套房', points: 2, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_2', label: '兩室一廳', points: 4, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_3', label: '三室兩廳', points: 6, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_house_5', label: '五室三廳', points: 8, checked: false, readOnly: true, parentId: 'h_house_self' },
        { id: 'h_child2', label: '擁有第二個孩子', points: 4, checked: false, readOnly: true },
        { id: 'h_plane', label: '擁有一架飛行器', points: 4, checked: false, readOnly: true },
        { id: 'h_career', label: `事業成就 (${enterprise.name})`, code: enterprise.id, description: `投資額: ${formatMoney(enterprise.cost)} | 月收: +${formatMoney(enterprise.income)}`, points: 10, checked: false, readOnly: true },
        { id: 'h_dream', label: `完成夢想 (${dream.name})`, code: dream.id, description: `花費: ${formatMoney(dream.cost)} ${dream.description ? '| ' + dream.description : ''}`, points: 10, checked: false, readOnly: true },
    ];
};
