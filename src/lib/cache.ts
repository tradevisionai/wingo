export const cacheData = (key: string, data: any, ttlMinutes: number = 60) => {
  const item = {
    data,
    expiry: new Date().getTime() + ttlMinutes * 60 * 1000,
  };
  localStorage.setItem(key, JSON.stringify(item));
};

export const getCachedData = (key: string) => {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) return null;
  const item = JSON.parse(itemStr);
  if (new Date().getTime() > item.expiry) {
    localStorage.removeItem(key);
    return null;
  }
  return item.data;
};

export const clearCache = () => {
  localStorage.clear();
};
