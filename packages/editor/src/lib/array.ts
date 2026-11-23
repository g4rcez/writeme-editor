export type ItemWithDate = {
    updatedAt: string | Date;
    [key: string]: any;
};

export const sortByNewest = <T extends ItemWithDate>(items: Array<T>): Array<T> => {
    return [...items].sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        if (Number.isNaN(dateA)) {return 1;}
        if (Number.isNaN(dateB)) {return -1;}
        return dateB - dateA;
    });
};
