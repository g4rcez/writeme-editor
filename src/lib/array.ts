export type ItemWithDate = {
  updatedAt: string | Date;
  [key: string]: any;
};

export const sortByNewest = <T extends ItemWithDate>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    if (isNaN(dateA)) return 1;
    if (isNaN(dateB)) return -1;
    return dateB - dateA;
  });
};
